/**
 * 机会页视图模型（模块 3 骨架）。
 *
 * 输入：v6.1 seed 公告 + 用户画像；输出：机会首页三层信息直接消费的结构。
 * 资格规则全部复用 lib/matching/domain.ts，本文件不重复实现任何判断逻辑；
 * 不做后端调用、不做 React 状态，纯函数确定性输出（测试依赖此性质）。
 */
import type {
  AnnouncementVersion,
  RecruitmentAnnouncement,
} from "@/lib/announcements/types";
import type { UserRecruitmentProfile } from "@/lib/profile/types";
import type {
  GateResult,
  MatchDimensionResult,
  OpportunityMatchStatus,
} from "@/lib/matching/types";
import {
  buildCandidates,
  groupByMissingDimension,
  isValidOpportunity,
  sortCandidates,
  type OpportunityCandidate,
} from "@/lib/matching/domain";
import { isRegistrationOpen } from "@/lib/announcements/domain";
import {
  dateWithWeekday,
  daysUntil,
  deadlineText,
  dimensionLabel,
  natureShortLabel,
  regionLabel,
  stageLabel,
} from "./labels";

/** 单条条件的行内展示（机会卡展开后的第二层） */
export interface DimensionView {
  label: string;
  value: MatchDimensionResult["value"];
  reason: string;
}

export interface OpportunityRow {
  unitId: string;
  announcementId: string;
  /** 地区/报考单元 */
  regionText: string;
  unitName: string;
  /** 用工性质/学段 */
  natureText: string;
  stageText: string;
  /** 招聘人数 */
  headcount: number;
  /** 匹配状态（四档文字，卡片不靠颜色表达） */
  status: OpportunityMatchStatus;
  /** 报名截止一句话 */
  deadline: string;
  /** 报名截止 ISO 日期（排序与剩余天数计算用，不直接展示） */
  registrationEnd: string;
  registrationClosed: boolean;
  /** 一句话依据 */
  oneLineReason: string;
  /** 闸门失败原因（已截止/未收录等；为空表示闸门全过） */
  gateReason: string | null;
  /** 逐项条件（第二层展开用） */
  dimensions: DimensionView[];
  /** 官方公告链接（第三层） */
  officialUrl: string;
  publisher: string;
  checkedAtText: string;
  registerUrl?: string;
}

export interface NeedInfoGroup {
  dimension: string;
  dimensionText: string;
  count: number;
  rows: OpportunityRow[];
}

export type RiskTone = "must" | "info";

export interface OpportunityRisk {
  tone: RiskTone;
  text: string;
}

export interface OpportunitiesView {
  /** 第一层：一句结论 */
  conclusion: string;
  /** 覆盖范围与更新时间（未覆盖 ≠ 没有招聘） */
  coverage: string;
  /** 第一层：一个风险（没有风险时为 null，不制造虚假紧迫感） */
  risk: OpportunityRisk | null;
  /** 第一层：唯一优先机会；无有效机会时为 null（页面转空态） */
  priority: OpportunityRow | null;
  /** 有效机会总数（闸门全过且非明确不符合） */
  validCount: number;
  preliminary: OpportunityRow[];
  needInfoGroups: NeedInfoGroup[];
  manualReview: OpportunityRow[];
  /** 闸门通过但总体明确不符合 */
  notEligible: OpportunityRow[];
  /** 闸门失败（已截止等），不进主要推荐但保留原因可查 */
  closed: OpportunityRow[];
}

function toRow(candidate: OpportunityCandidate, nowIso: string): OpportunityRow {
  const { announcement, version, unit, match } = candidate;
  const closedGate = match.gates.find((g) => !g.passed) ?? null;
  const deadline = deadlineText(version.timeline.registrationEnd, nowIso);
  return {
    unitId: unit.id,
    announcementId: announcement.id,
    regionText: regionLabel(unit.region),
    unitName: unit.name,
    natureText: natureShortLabel(unit.employmentNature.code),
    stageText: stageLabel(unit.stage),
    headcount: unit.headcount,
    status: match.overall,
    deadline: deadline.text,
    registrationEnd: version.timeline.registrationEnd,
    registrationClosed: deadline.closed,
    oneLineReason: match.summary,
    gateReason: closedGate ? closedGate.reason : null,
    dimensions: match.dimensions.map((d) => ({
      label: dimensionLabel(d.dimension),
      value: d.value,
      reason: d.reason,
    })),
    officialUrl: announcement.officialUrl,
    publisher: announcement.publisher,
    checkedAtText: dateWithWeekday(version.officialSource.checkedAt.slice(0, 10)),
    registerUrl: unit.registerUrl,
  };
}

function gateFailText(gates: GateResult[]): string | null {
  const failed = gates.find((g) => !g.passed);
  return failed ? failed.reason : null;
}

/** 7 天内截止才提示紧急风险；更远的截止不制造焦虑 */
const URGENT_WINDOW_DAYS = 7;

function buildRisk(rows: OpportunityRow[], nowIso: string): OpportunityRisk | null {
  const urgent = rows
    .filter((r) => !r.registrationClosed)
    .sort(
      (a, b) =>
        daysUntil(a.registrationEnd, nowIso) - daysUntil(b.registrationEnd, nowIso),
    )[0];
  if (!urgent) return null;
  const daysLeft = daysUntil(urgent.registrationEnd, nowIso);
  if (daysLeft <= URGENT_WINDOW_DAYS && daysLeft >= 0) {
    return { tone: "must", text: `${urgent.regionText}的机会${urgent.deadline}，先确认能否按时提交材料` };
  }
  return {
    tone: "info",
    text: "以下为初步匹配结果，不等于保证可以报名；最终资格以招聘单位审核为准",
  };
}

export function buildOpportunitiesView(
  announcements: RecruitmentAnnouncement[],
  profile: UserRecruitmentProfile,
  nowIso: string,
): OpportunitiesView {
  const candidates = buildCandidates(announcements, profile, nowIso);
  const sorted = sortCandidates(candidates, profile);

  const valid = sorted.filter((c) => isValidOpportunity(c.match));
  const invalid = sorted.filter((c) => !isValidOpportunity(c.match));

  const preliminary = valid.filter((c) => c.match.overall === "preliminary_eligible");
  const needInfoGroups = groupByMissingDimension(valid).map((group) => ({
    dimension: group.dimension,
    dimensionText: dimensionLabel(group.dimension),
    count: group.count,
    rows: group.candidates.map((c) => toRow(c, nowIso)),
  }));
  const manualReview = valid
    .filter((c) => c.match.overall === "manual_review")
    .map((c) => toRow(c, nowIso));
  const notEligible = invalid
    .filter((c) => c.match.gates.every((g) => g.passed))
    .map((c) => toRow(c, nowIso));
  const closed = invalid
    .filter((c) => !c.match.gates.every((g) => g.passed))
    .map((c) => toRow(c, nowIso));

  const preliminaryRows = preliminary.map((c) => toRow(c, nowIso));
  const priority = preliminaryRows[0]
    ?? valid[0]
      ? toRow(valid[0], nowIso)
      : null;

  const provinces = [...new Set(announcements.map((a) => a.region.province))].join("、");
  const coverage = `已覆盖 ${provinces} 的官方公告 · 更新于 ${dateWithWeekday(nowIso.slice(0, 10))} · 未覆盖地区不等于没有招聘`;

  let conclusion: string;
  if (preliminaryRows.length > 0) {
    conclusion = `为你找到 ${preliminaryRows.length} 个初步符合的语文教师机会`;
  } else if (valid.length > 0) {
    conclusion = `有 ${valid.length} 个机会需要补充信息后才能判断`;
  } else {
    conclusion = "当前已覆盖的官方公告中，还没有你能直接考虑的机会";
  }

  const riskSource = priority ? [priority] : [];
  const risk = buildRisk(riskSource, nowIso);

  return {
    conclusion,
    coverage,
    risk,
    priority,
    validCount: valid.length,
    preliminary: preliminaryRows,
    needInfoGroups,
    manualReview,
    notEligible,
    closed,
  };
}

/** 报名是否仍在进行（页面按钮可用性判断，复用公告域规则） */
export function canRegister(version: AnnouncementVersion, nowIso: string): boolean {
  return isRegistrationOpen(version, nowIso);
}

/** 闸门原因的便捷读取（第三层/分组角标用） */
export function describeGateFailure(candidate: OpportunityCandidate): string | null {
  return gateFailText(candidate.match.gates);
}
