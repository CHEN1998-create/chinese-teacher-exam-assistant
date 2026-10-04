/**
 * 日程页视图模型（模块 3 骨架）。
 *
 * 只从“已关注机会”的当前已发布公告版本派生时间线（PRD：不关注的机会不制造
 * 提醒）。时间未定一律输出 pending=true，展示“待官方通知”，禁止推测日期。
 * 纯函数、确定性；事件来源/变更留痕属于模块 6，本模块只做只读骨架。
 */
import type {
  AnnouncementVersion,
  ApplicationUnit,
  RecruitmentAnnouncement,
} from "@/lib/announcements/types";
import type { FollowedOpportunity } from "@/lib/opportunities/types";
import { currentVersion } from "@/lib/announcements/domain";
import { dateWithWeekday, daysUntil, regionLabel } from "./labels";

export type ScheduleEventKind =
  | "registration_start"
  | "registration_end"
  | "written_exam"
  | "pending_notice";

/** 通知强度三档（docs IA 第 5 节） */
export type ScheduleUrgency = "must" | "suggest" | "info";

export interface ScheduleEvent {
  id: string;
  kind: ScheduleEventKind;
  kindLabel: string;
  /** ISO 日期；待官方通知时为空 */
  dateIso: string | null;
  dateText: string;
  /** 待官方通知（时间未定，不显示任何推测日期） */
  pending: boolean;
  urgency: ScheduleUrgency;
  past: boolean;
  /** 该事件的唯一下一步（没有动作时为 null） */
  action: { label: string; href: string; external?: boolean } | null;
}

export interface ScheduleGroup {
  unitId: string;
  title: string;
  regionText: string;
  events: ScheduleEvent[];
}

export interface NextScheduleItem {
  event: ScheduleEvent;
  /** 事件所属报考单元（首屏一句话需要说明“哪件事”） */
  groupTitle: string;
  regionText: string;
}

export interface ScheduleView {
  /** 第一层：下一件不能错过的事；无关注/无待办时为 null（页面给明确空态） */
  next: NextScheduleItem | null;
  groups: ScheduleGroup[];
}

interface ResolvedFollow {
  follow: FollowedOpportunity;
  announcement: RecruitmentAnnouncement;
  version: AnnouncementVersion;
  unit: ApplicationUnit;
}

function resolveFollow(
  follow: FollowedOpportunity,
  announcements: RecruitmentAnnouncement[],
): ResolvedFollow | null {
  const announcement = announcements.find((a) => a.id === follow.announcementId);
  if (!announcement) return null;
  const version = currentVersion(announcement);
  const unit =
    version.units.find((u) => u.id === follow.unitId) ??
    announcement.versions.flatMap((v) => v.units).find((u) => u.id === follow.unitId);
  if (!unit) return null;
  return { follow, announcement, version, unit };
}

function buildEvents(resolved: ResolvedFollow, nowIso: string): ScheduleEvent[] {
  const { version, unit } = resolved;
  const timeline = version.timeline;
  const events: ScheduleEvent[] = [];

  const past = (iso: string) => daysUntil(iso, nowIso) < 0;

  events.push({
    id: `${unit.id}-registration-start`,
    kind: "registration_start",
    kindLabel: "报名开始",
    dateIso: timeline.registrationStart,
    dateText: dateWithWeekday(timeline.registrationStart),
    pending: false,
    urgency: "info",
    past: past(timeline.registrationStart),
    action: null,
  });

  events.push({
    id: `${unit.id}-registration-end`,
    kind: "registration_end",
    kindLabel: "报名截止",
    dateIso: timeline.registrationEnd,
    dateText: dateWithWeekday(timeline.registrationEnd),
    pending: false,
    urgency: "must",
    past: past(timeline.registrationEnd),
    action:
      !past(timeline.registrationEnd) && unit.registerUrl
        ? { label: "去报名入口", href: unit.registerUrl, external: true }
        : null,
  });

  if (timeline.writtenExamDate) {
    events.push({
      id: `${unit.id}-written-exam`,
      kind: "written_exam",
      kindLabel: "笔试",
      dateIso: timeline.writtenExamDate,
      dateText: dateWithWeekday(timeline.writtenExamDate),
      pending: false,
      urgency: "suggest",
      past: past(timeline.writtenExamDate),
      action: !past(timeline.writtenExamDate)
        ? { label: "去备考", href: "/study" }
        : null,
    });
  }

  // 时间未定事项：保留官方原句（如“面试时间待官方通知”），不推测日期
  for (const [index, item] of (timeline.pendingItems ?? []).entries()) {
    events.push({
      id: `${unit.id}-pending-${index}`,
      kind: "pending_notice",
      kindLabel: item,
      dateIso: null,
      dateText: "待官方通知",
      pending: true,
      urgency: "info",
      past: false,
      action: null,
    });
  }

  return events;
}

const KIND_ORDER: ScheduleEventKind[] = [
  "registration_start",
  "registration_end",
  "written_exam",
  "pending_notice",
];

export function buildScheduleView(
  follows: FollowedOpportunity[],
  announcements: RecruitmentAnnouncement[],
  nowIso: string,
): ScheduleView {
  const activeFollows = follows.filter(
    (f) => f.status !== "abandoned" && f.status !== "closed",
  );

  const groups: ScheduleGroup[] = [];
  for (const follow of activeFollows) {
    const resolved = resolveFollow(follow, announcements);
    if (!resolved) continue;
    const events = buildEvents(resolved, nowIso).sort(
      (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
    );
    groups.push({
      unitId: resolved.unit.id,
      title: resolved.unit.name,
      regionText: regionLabel(resolved.unit.region),
      events,
    });
  }

  // 下一件：所有关注机会中“尚未过去、带行动”的最早事件；
  // 必须处理（报名截止）优先于建议处理（备考），同强度再比日期。
  const URGENCY_RANK: Record<ScheduleUrgency, number> = { must: 0, suggest: 1, info: 2 };
  const upcoming = groups
    .flatMap((g) =>
      g.events
        .filter((e) => e.action && !e.past && e.dateIso)
        .map((event) => ({ event, groupTitle: g.title, regionText: g.regionText })),
    )
    .sort((a, b) => {
      const byUrgency = URGENCY_RANK[a.event.urgency] - URGENCY_RANK[b.event.urgency];
      if (byUrgency !== 0) return byUrgency;
      return (a.event.dateIso ?? "").localeCompare(b.event.dateIso ?? "");
    });

  return { next: upcoming[0] ?? null, groups };
}
