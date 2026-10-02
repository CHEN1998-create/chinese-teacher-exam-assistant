/**
 * 首次体验：轻量结果生成（确定性规则，纯函数）。
 *
 * 输入为访客三步问答的答案 + 已有目标与考情证据（含内置演示种子）。
 * 输出“今日第一步 + 7 天主题预览”：
 * - 匹配到已从官方公告核对的考情时，今日任务基于真实核对信息给出；
 * - 未能核对时，今日任务是一项具体的信息查找任务，并明确列出哪些内容仍待核对，
 *   绝不编造当地考试科目或日期。
 *
 * 该结果只是首次体验的轻量预览，不是经过资料诊断的正式计划；
 * 正式计划在保存后由 PlanEngine（lib/plans/domain.ts）生成。
 */
import { EvidenceItem, ExamTarget, EDUCATION_LEVEL_LABELS } from "@/types";
import { GuestAnswers } from "./guestSession";

export interface FirstResultTask {
  title: string;
  estimatedMinutes: number;
  completionCriteria: string;
  reason: string;
}

export interface FirstResult {
  /** 你准备的考试（展示名） */
  examName: string;
  /** 是否匹配到已核对的考情 */
  verified: boolean;
  /** 匹配到的已核对目标名称（verified 时展示） */
  matchedTargetName?: string;
  /** 已从官方公告核对的关键信息 */
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

const MIN_TASK_MINUTES = 20;

function clampMinutes(requested: number | undefined, fallback: number): number {
  const minutes = requested && requested > 0 ? requested : fallback;
  return Math.max(MIN_TASK_MINUTES, Math.min(minutes, 60));
}

/** 按地区匹配已有目标（同省+同城市/招聘单位优先，其次同省），用于复用已核对的考情 */
export function findMatchedTarget(
  answers: GuestAnswers,
  allTargets: ExamTarget[]
): ExamTarget | null {
  const province = answers.province?.trim();
  const city = answers.city?.trim();
  const recruiter = answers.recruiter?.trim();
  if (!province && !city && !recruiter) return null;

  const active = allTargets.filter((t) => t.status !== "archived");
  const sameCity = active.find(
    (t) =>
      (!province || t.province === province) &&
      ((city && (t.city === city || t.recruiter === city)) ||
        (recruiter && (t.recruiter === recruiter || t.city === recruiter)))
  );
  if (sameCity) return sameCity;
  if (province) {
    return active.find((t) => t.province === province) ?? null;
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

/** 高影响字段中，已核对（official）才算数；其余状态一律视为待核对 */
function officialFacts(
  evidence: EvidenceItem[],
  fields: { field: EvidenceItem["field"]; label: string }[]
): { label: string; value: string }[] {
  const facts: { label: string; value: string }[] = [];
  for (const { field, label } of fields) {
    const item = evidence.find(
      (e) => e.field === field && e.reviewStatus === "official" && e.value.trim()
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

/** 生成首次结果 */
export function buildFirstResult(
  answers: GuestAnswers,
  allTargets: ExamTarget[],
  allEvidence: EvidenceItem[]
): FirstResult {
  const matched = findMatchedTarget(answers, allTargets);
  const matchedEvidence = matched
    ? allEvidence.filter((e) => e.examTargetId === matched.id)
    : [];
  const facts = officialFacts(matchedEvidence, HIGH_IMPACT_FIELDS);
  const verified = facts.some((f) => f.label === "考试科目" || f.label === "考试范围");
  const taskMinutes = clampMinutes(answers.dailyAvailableMinutes, 45);

  // 仍待核对的内容 = 高影响字段中没有 official 结论的部分
  const confirmedLabels = new Set(facts.map((f) => f.label));
  const pendingChecks = HIGH_IMPACT_FIELDS.map((f) => f.label).filter(
    (l) => !confirmedLabels.has(l)
  );

  const sources = Array.from(
    new Map(
      matchedEvidence
        .filter((e) => e.reviewStatus === "official" && e.sourceName)
        .map((e) => [e.sourceName, { name: e.sourceName, url: e.sourceUrl }])
    ).values()
  );

  if (!verified) {
    const place = answers.city || answers.recruiter || answers.province || "目标地区";
    return {
      examName: examName(answers),
      verified: false,
      confirmedFacts: facts,
      pendingChecks,
      todayTask: {
        title: `找到「${place}」最新的教师招聘公告`,
        estimatedMinutes: taskMinutes,
        completionCriteria:
          "在目标地区教育局或人社局官网找到最新招聘公告，保存公告链接，并记下报名时间、考试科目这两项信息",
        reason:
          "你提供的信息还不足以确认这次考试怎么考。先核对官方公告，再安排学习内容，避免按错误的科目或时间准备。",
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

  const subjectsFact = facts.find((f) => f.label === "考试科目")?.value ?? "";
  const hasGeneral = subjectsFact.includes("教育综合") || subjectsFact.includes("教综");

  return {
    examName: matched!.name || examName(answers),
    verified: true,
    matchedTargetName: matched!.name,
    confirmedFacts: facts,
    pendingChecks,
    todayTask: {
      title: "弄清这次考试怎么考，盘点自己的起点",
      estimatedMinutes: taskMinutes,
      completionCriteria:
        "通读下面已核对的考试范围，列出 3 个你最没把握的内容（写在纸上或备忘录即可）",
      reason:
        "开始具体学习前，先弄清考什么、自己的薄弱点在哪里，接下来 7 天的安排才不会偏。",
    },
    weekThemes: [
      "第 1 天：了解考试范围，盘点自身起点",
      "第 2 天：现代汉语基础",
      "第 3 天：古代汉语与文学常识",
      "第 4 天：语文课程标准与教学设计",
      hasGeneral ? "第 5 天：教育综合知识入门" : "第 5 天：写作与案例分析",
      "第 6 天：薄弱环节针对练习",
      "第 7 天：本周回顾与下周安排",
    ],
    sources,
  };
}
