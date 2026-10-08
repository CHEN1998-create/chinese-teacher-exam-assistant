import type { GoalDTO, GoalsResponse } from "@/lib/opportunities/api-types";

export interface MyProgressView {
  savedCount: number;
  primaryName: string | null;
  nearestDeadline: string | null;
  conclusion: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  actionVariant: "primary" | "outline";
}

function futureRegistrationEnd(goal: GoalDTO, nowMs: number): number | null {
  const value = goal.version.timeline.registrationEnd;
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) || timestamp < nowMs ? null : timestamp;
}

function formatDeadline(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/** “我的”首屏只给一个当前结论和一个下一步，避免退化为设置入口集合。 */
export function buildMyProgressView(
  data: GoalsResponse,
  nowIso: string = new Date().toISOString(),
): MyProgressView {
  const nowMs = Date.parse(nowIso);
  const safeNow = Number.isNaN(nowMs) ? Date.now() : nowMs;
  const primary = data.goals.find((goal) => goal.unitId === data.primaryTargetUnitId) ?? null;
  const nearestTimestamp = data.goals
    .map((goal) => futureRegistrationEnd(goal, safeNow))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b)[0];
  const nearestDeadline = nearestTimestamp ? formatDeadline(nearestTimestamp) : null;

  if (primary) {
    return {
      savedCount: data.goals.length,
      primaryName: primary.unitName,
      nearestDeadline,
      conclusion: `继续准备「${primary.unitName}」`,
      description: nearestDeadline
        ? `最近一个报名节点在 ${nearestDeadline}，今天可以继续推进备考。`
        : "重点机会已经确定，今天可以继续推进备考。",
      actionLabel: "继续备考",
      actionHref: "/study",
      actionVariant: "primary",
    };
  }

  if (data.goals.length > 0) {
    const first = data.goals[0]!;
    return {
      savedCount: data.goals.length,
      primaryName: null,
      nearestDeadline,
      conclusion: `已经保存 ${data.goals.length} 个机会`,
      description: "选一个作为重点准备的机会后，才能生成对应的备考安排。",
      actionLabel: "选择重点机会",
      actionHref: `/opportunities/${first.unitId}`,
      actionVariant: "primary",
    };
  }

  return {
    savedCount: 0,
    primaryName: null,
    nearestDeadline: null,
    conclusion: "还没有保存机会",
    description: "看到合适的真实机会后先保存，报名时间和后续进度会集中在这里。",
    actionLabel: "去看看机会",
    actionHref: "/opportunities",
    actionVariant: "outline",
  };
}
