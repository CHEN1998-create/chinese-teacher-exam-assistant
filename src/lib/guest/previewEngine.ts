/**
 * 首次体验：轻量结果生成（确定性规则，纯函数）。
 *
 * 输入为访客三步问答的答案 + 已有目标、考情证据与公共资源（含内置演示种子）。
 * 输出“今日第一步 + 7 天主题预览”：
 * - 只有地区、学段（及招聘单位）与某个已核对目标唯一精确匹配，
 *   且关键字段存在“可查看来源的已核对信息”时，才称为“针对这场考试的安排”；
 * - 同省但学段/批次/招聘单位不匹配，或存在多个候选无法区分批次时，
 *   一律视为“暂未支持”，只给明确标注“通用起步建议”的任务；
 * - 精确匹配但考情尚未核对时，今日任务是一项具体的信息查找任务，
 *   并明确列出哪些内容仍待核对，绝不编造当地考试科目或日期。
 *
 * 该结果只是首次体验的轻量预览，不是经过资料诊断的正式计划；
 * 正式计划在保存后由 PlanEngine（lib/plans/domain.ts）生成。
 */
import {
  EvidenceItem,
  ExamTarget,
  ResourceItem,
  EDUCATION_LEVEL_LABELS,
} from "@/types";
import { checkRecommendable } from "@/lib/resources/domain";
import { GuestAnswers } from "./guestSession";

/** 任务性质：学习任务 / 信息查找任务 / 通用起步建议 */
export type FirstTaskKind = "study" | "info_find" | "general_starter";

/** 任务资料入口（“用什么”） */
export interface FirstTaskMaterial {
  /**
   * resource=可打开的公共资源；
   * evidence_source=已核对证据自带的可查看来源链接；
   * user_material=用户已确认拥有的资料。
   */
  kind: "resource" | "evidence_source" | "user_material";
  name: string;
  url?: string;
  materialId?: string;
}

export interface FirstResultTask {
  title: string;
  estimatedMinutes: number;
  completionCriteria: string;
  reason: string;
  kind: FirstTaskKind;
  /** 有可打开资料或用户已确认资料时为 true；无资料入口时必须为 false */
  executable: boolean;
  /** 用什么资料（五要素之一） */
  material?: FirstTaskMaterial;
  /** 是否为通用起步建议（明确不是针对当地考情的定制安排） */
  generalAdvice: boolean;
}

/** 支持状态：supported=可给出针对这场考试的安排；unsupported=暂未支持 */
export type SupportStatus = "supported" | "unsupported";

export interface FirstResult {
  /** 你准备的考试（展示名） */
  examName: string;
  supportStatus: SupportStatus;
  /** 支持状态说明（用户可见） */
  supportNote: string;
  /** 匹配到的已核对目标名称（supported 时展示） */
  matchedTargetName?: string;
  /** 已从官方公告核对（且来源可查看）的关键信息 */
  confirmedFacts: { label: string; value: string }[];
  /** 仍待核对的内容（未核对或部分核对时展示） */
  pendingChecks: string[];
  /** 今天先做的一项任务 */
  todayTask: FirstResultTask;
  /** 7 天主题预览 */
  weekThemes: string[];
  /** 考情来源（按需展开） */
  sources: { name: string; url?: string }[];
}

/** 目标匹配结果 */
export interface TargetMatch {
  target: ExamTarget;
  /** exact=范围唯一精确匹配；province_only=仅同省，不能作为定制依据 */
  level: "exact" | "province_only";
}

const MIN_TASK_MINUTES = 20;

function clampMinutes(requested: number | undefined, fallback: number): number {
  const minutes = requested && requested > 0 ? requested : fallback;
  return Math.max(MIN_TASK_MINUTES, Math.min(minutes, 60));
}

function isHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** 单个维度是否匹配：答案给了要求一致；答案没给要求目标也未标注（避免替用户假设） */
function dimensionMatches(answer: string | undefined, targetValue: string | undefined): boolean {
  const a = answer?.trim();
  const t = targetValue?.trim();
  if (a) return t === a;
  return !t;
}

/**
 * 按“地区 + 学段 + 招聘单位”匹配已有目标：
 * - 所有维度唯一一致 → exact；
 * - 同省但维度不符，或多个候选无法区分批次 → 返回 province_only（如有同省目标）或 null。
 */
export function findMatchedTarget(
  answers: GuestAnswers,
  allTargets: ExamTarget[]
): TargetMatch | null {
  const province = answers.province?.trim();
  const city = answers.city?.trim();
  const recruiter = answers.recruiter?.trim();
  if (!province && !city && !recruiter) return null;

  const active = allTargets.filter((t) => t.status !== "archived");

  const exactCandidates = active.filter((t) => {
    // 省份必须一致
    if (province && t.province?.trim() !== province) return false;
    if (!province) return false;
    // 城市/招聘单位
    const answerPlace = city ?? recruiter;
    const targetPlace = t.city?.trim() ?? t.recruiter?.trim();
    if (!dimensionMatches(answerPlace, targetPlace)) return false;
    // 学段
    if (answers.educationLevel) {
      if (t.educationLevel !== answers.educationLevel) return false;
    } else if (t.educationLevel) {
      return false;
    }
    return true;
  });

  // 唯一精确匹配才算数；多个候选（批次/年份/招聘类型不同，答案无法区分）视为不明确
  if (exactCandidates.length === 1) {
    return { target: exactCandidates[0], level: "exact" };
  }

  // 同省其他目标：只能作为“暂未支持”的提示依据，不能套用其考情
  if (province && active.some((t) => t.province?.trim() === province)) {
    const sameProvince = active.find((t) => t.province?.trim() === province);
    return sameProvince ? { target: sameProvince, level: "province_only" } : null;
  }
  return null;
}

function examName(answers: GuestAnswers): string {
  const region = [answers.province, answers.city || answers.recruiter]
    .filter(Boolean)
    .join(" · ");
  const level = answers.educationLevel ? EDUCATION_LEVEL_LABELS[answers.educationLevel] : "";
  return [region, `${level}语文教师招聘`].filter(Boolean).join(" ") || "语文教师招聘";
}

/** 已核对结论必须同时具备可查看的来源名称与可打开链接，否则只能算“还在核对” */
function hasViewableSource(item: EvidenceItem): boolean {
  return item.sourceName.trim().length > 0 && isHttpUrl(item.sourceUrl);
}

/**
 * 高影响字段中，已核对（official）且来源可查看才算数；
 * 其余状态（含缺来源链接的 official 记录）一律视为待核对。
 */
function officialFacts(
  evidence: EvidenceItem[],
  fields: { field: EvidenceItem["field"]; label: string }[]
): { label: string; value: string }[] {
  const facts: { label: string; value: string }[] = [];
  for (const { field, label } of fields) {
    const item = evidence.find(
      (e) =>
        e.field === field &&
        e.reviewStatus === "official" &&
        e.value.trim() &&
        hasViewableSource(e)
    );
    if (item) facts.push({ label, value: item.value });
  }
  return facts;
}

const HIGH_IMPACT_FIELDS: { field: EvidenceItem["field"]; label: string }[] = [
  { field: "subjects", label: "考试科目" },
  { field: "exam_scope", label: "考试范围" },
  { field: "registration_time", label: "报名时间" },
  { field: "exam_time", label: "考试时间" },
  { field: "qualification", label: "报考条件" },
];

/**
 * 构造“通用起步建议”任务：优先使用全国通用、通过合规闸门的公共资源。
 * 找不到可用资源时返回不可执行的通用建议（不编造资料）。
 */
function buildGeneralStarter(
  allResources: ResourceItem[],
  taskMinutes: number,
  nowIso: string
): FirstResultTask {
  // 全国通用且当前可推荐的资源（与资源缺口匹配同一闸门），取第一条
  const national = allResources.find(
    (r) =>
      r.applicableRegions.some((x) => x.includes("全国")) &&
      checkRecommendable(r, nowIso).ok
  );

  if (national) {
    const chapter = national.suggestedChapters[0];
    return {
      title: `通用起步：学习「${national.title}」${chapter ? `的「${chapter}」` : ""}`,
      estimatedMinutes: clampMinutes(undefined, Math.min(national.estimatedMinutes || 40, 40)),
      completionCriteria: `打开资源链接${chapter ? `读完「${chapter}」` : "完成建议内容"}，用自己的话记下 3 条关键结论`,
      reason: "暂未支持针对你这场考试的安排；这是不依赖当地考情的通用起步建议，考情核对后再生成针对这场考试的任务。",
      kind: "general_starter",
      executable: true,
      material: { kind: "resource", name: national.title, url: national.sourceUrl },
      generalAdvice: true,
    };
  }

  return {
    title: "通用起步：建立备考信息清单",
    estimatedMinutes: taskMinutes,
    completionCriteria: "在备忘录列出：目标考试名称、官方公告链接渠道、每天可用时间三项",
    reason: "暂未支持针对你这场考试的安排，且暂时没有可直接打开的合规资源；先完成信息准备，不会按编造的考情安排学习。",
    kind: "general_starter",
    executable: false,
    generalAdvice: true,
  };
}

/** 生成首次结果 */
export function buildFirstResult(
  answers: GuestAnswers,
  allTargets: ExamTarget[],
  allEvidence: EvidenceItem[],
  allResources: ResourceItem[],
  nowIso: string
): FirstResult {
  const match = findMatchedTarget(answers, allTargets);
  const exact = match?.level === "exact" ? match.target : null;
  const matchedEvidence = exact
    ? allEvidence.filter((e) => e.examTargetId === exact.id)
    : [];
  const facts = officialFacts(matchedEvidence, HIGH_IMPACT_FIELDS);
  // 只有精确匹配 + 考试科目或范围已有“来源可查看的已核对信息”，才支持针对这场考试的安排
  const verified =
    exact !== null &&
    facts.some((f) => f.label === "考试科目" || f.label === "考试范围");
  const taskMinutes = clampMinutes(answers.dailyAvailableMinutes, 45);

  // 仍待核对的内容 = 高影响字段中没有可查看 official 结论的部分
  const confirmedLabels = new Set(facts.map((f) => f.label));
  const pendingChecks = HIGH_IMPACT_FIELDS.map((f) => f.label).filter(
    (l) => !confirmedLabels.has(l)
  );

  const sources = Array.from(
    new Map(
      matchedEvidence
        .filter((e) => e.reviewStatus === "official" && hasViewableSource(e))
        .map((e) => [e.sourceName, { name: e.sourceName, url: e.sourceUrl }])
    ).values()
  );

  // ========== 未支持：通用起步建议 ==========
  if (!verified) {
    const supportNote =
      match?.level === "province_only"
        ? "暂未支持针对这场考试的安排：仅找到同省其他批次/学段的考试信息，不能直接套用；下面是通用起步建议。"
        : exact
          ? "这场考试的关键考情还在核对中：下面第一项是信息查找任务，不是正式学习安排。"
          : "暂未支持针对这场考试的安排；下面提供不依赖当地考情的通用起步建议。";

    // 精确匹配但未核对：给具体的信息查找任务；其余情况给通用起步建议
    if (exact) {
      const place = answers.city || answers.recruiter || answers.province || "目标地区";
      return {
        examName: examName(answers),
        supportStatus: "unsupported",
        supportNote,
        confirmedFacts: facts,
        pendingChecks,
        todayTask: {
          title: `找到「${place}」最新的教师招聘公告`,
          estimatedMinutes: taskMinutes,
          completionCriteria:
            "在目标地区教育局或人社局官网找到最新招聘公告，保存公告链接，并记下报名时间、考试科目这两项信息",
          reason:
            "你提供的信息还不足以确认这次考试怎么考。先核对官方公告，再安排学习内容，避免按错误的科目或时间准备。",
          kind: "info_find",
          executable: false,
          generalAdvice: false,
        },
        weekThemes: [
          "第 1 天：找到官方公告，核对这次考试怎么考",
          "第 2 天：确认自己是否符合报考条件",
          "第 3 天起：根据核对到的考试科目安排学习（待核对后生成）",
          "第 7 天：回顾本周，调整下周安排",
        ],
        sources,
      };
    }

    return {
      examName: examName(answers),
      supportStatus: "unsupported",
      supportNote,
      confirmedFacts: facts,
      pendingChecks,
      todayTask: buildGeneralStarter(allResources, taskMinutes, nowIso),
      weekThemes: [
        "第 1 天：通用起步——建立备考信息清单",
        "第 2-3 天：查找官方公告，核对考试科目与时间",
        "第 4-6 天：按核对到的科目安排学习（待核对后生成）",
        "第 7 天：回顾本周，确认下周安排",
      ],
      sources,
    };
  }

  // ========== 已支持：针对这场考试的学习任务 ==========
  // 资料入口：考试范围/科目已核对证据自带的可查看官方来源链接
  const scopeItem = matchedEvidence.find(
    (e) =>
      (e.field === "exam_scope" || e.field === "subjects") &&
      e.reviewStatus === "official" &&
      hasViewableSource(e)
  );

  return {
    examName: exact!.name || examName(answers),
    supportStatus: "supported",
    supportNote: "已从官方公告核对这场考试的关键信息，以下安排针对这场考试。",
    matchedTargetName: exact!.name,
    confirmedFacts: facts,
    pendingChecks,
    todayTask: {
      title: "通读已核对的考试范围，列出 3 个薄弱点",
      estimatedMinutes: taskMinutes,
      completionCriteria:
        "打开来源链接通读「考试范围」，在备忘录列出 3 个你最没把握的内容",
      reason:
        "开始具体学习前，先弄清考什么、自己的薄弱点在哪里，接下来 7 天的安排才不会偏。",
      kind: "study",
      executable: true,
      material: scopeItem
        ? {
            kind: "evidence_source",
            name: scopeItem.sourceName,
            url: scopeItem.sourceUrl,
          }
        : undefined,
      generalAdvice: false,
    },
    weekThemes: [
      "第 1 天：了解考试范围，盘点自身起点",
      "第 2 天：现代汉语基础",
      "第 3 天：古代汉语与文学常识",
      "第 4 天：语文课程标准与教学设计",
      "第 5 天：写作与案例分析",
      "第 6 天：薄弱环节针对练习",
      "第 7 天：本周回顾与下周安排",
    ],
    sources,
  };
}
