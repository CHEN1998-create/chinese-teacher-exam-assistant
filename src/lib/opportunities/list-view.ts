/**
 * 机会列表视图模型（纯函数，模块 5）。
 *
 * 输入是后端 MatchResponse（分组与排序已由后端完成），这里只决定页面叙事：
 * - 第一屏的“优先机会”：用户设置的主要备考目标优先，否则取首个初步符合；
 * - 结论文案与有效机会计数。
 * 不做任何资格判定，判定规则只存在于后端。
 */
import type {
  MatchResponse,
  MetaDTO,
  UnitMatchDTO,
} from "./api-types";

export interface OpportunityListViewModel {
  meta: MetaDTO;
  primaryTargetUnitId: string | null;
  /** 第一屏优先机会（主要目标或首个初步符合），可能为 null */
  priority: UnitMatchDTO | null;
  /** 初步符合中除优先外的其余机会（保持后端顺序） */
  otherPreliminary: UnitMatchDTO[];
  needInfoGroups: MatchResponse["groups"]["needInfo"];
  manualReview: UnitMatchDTO[];
  notEligible: UnitMatchDTO[];
  closed: UnitMatchDTO[];
  /** 有效机会数（闸门通过且非明确不符合；已截止不计） */
  validCount: number;
  /** Hero 主结论 */
  conclusion: string;
  /** 已截止/明确不符合的数量，用于风险提示 */
  excludedCount: number;
}

function pickPriority(
  preliminary: UnitMatchDTO[],
  primaryTargetUnitId: string | null,
): UnitMatchDTO | null {
  if (preliminary.length === 0) return null;
  const primary = primaryTargetUnitId
    ? preliminary.find((u) => u.unit.id === primaryTargetUnitId)
    : undefined;
  return primary ?? preliminary[0]!;
}

export function buildListViewModel(response: MatchResponse): OpportunityListViewModel {
  const { groups, primaryTargetUnitId, meta } = response;
  const priority = pickPriority(groups.preliminary, primaryTargetUnitId);
  const otherPreliminary = groups.preliminary.filter(
    (u) => u.unit.id !== priority?.unit.id,
  );
  const needInfoCount = groups.needInfo.reduce((sum, g) => sum + g.count, 0);
  const validCount =
    groups.preliminary.length + needInfoCount + groups.manualReview.length;
  const excludedCount = groups.notEligible.length + groups.closed.length;

  let conclusion: string;
  if (groups.preliminary.length > 0) {
    const extras: string[] = [];
    if (needInfoCount > 0) extras.push(`${needInfoCount} 个待补充信息`);
    if (groups.manualReview.length > 0)
      extras.push(`${groups.manualReview.length} 个建议人工确认`);
    conclusion =
      `为你找到 ${groups.preliminary.length} 个初步符合的机会` +
      (extras.length > 0 ? `（另有 ${extras.join("、")}）` : "");
  } else if (needInfoCount > 0) {
    conclusion = `还没有能直接判断的机会：补充 ${needInfoCount} 个机会缺失的信息后会重新判断`;
  } else if (groups.manualReview.length > 0) {
    conclusion = `有 ${groups.manualReview.length} 个机会的条件需要向招聘单位确认`;
  } else {
    conclusion = "当前没有与你画像匹配的有效机会，完善画像后会重新评估";
  }

  return {
    meta,
    primaryTargetUnitId,
    priority,
    otherPreliminary,
    needInfoGroups: groups.needInfo,
    manualReview: groups.manualReview,
    notEligible: groups.notEligible,
    closed: groups.closed,
    validCount,
    conclusion,
    excludedCount,
  };
}

/** “M月D日 HH:mm”短格式（评估时间展示） */
export function formatEvaluatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
