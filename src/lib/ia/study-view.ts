/**
 * 备考页视图模型（模块 3 骨架）。
 *
 * 进入门禁（docs IA 第 6 节）：
 * 1. 已选择一个主要备考目标（关注记录 role=primary）；
 * 2. 该目标考试内容与来源已核对。
 * 本轮不接 PlanEngine（模块 7），门禁未过时第一层只给“下一步”，
 * 已选目标但未核对考情时给信息查找任务，绝不编造科目与日期。
 */
import type { RecruitmentAnnouncement } from "@/lib/announcements/types";
import type { FollowedOpportunity } from "@/lib/opportunities/types";
import { currentVersion } from "@/lib/announcements/domain";
import { dateWithWeekday, regionLabel, stageLabel } from "./labels";

export type StudyGate = "no_primary" | "exam_unverified" | "ready";

export interface TodayTaskBrief {
  /** 做什么 */
  title: string;
  /** 用什么 */
  materials: string;
  /** 预计多久 */
  durationMinutes: number;
  /** 怎样算完成 */
  doneWhen: string;
  /** 为什么先做 */
  whyFirst: string;
  /** 相关官方链接 */
  officialUrl: string;
}

export interface StudyTargetBrief {
  unitId: string;
  unitName: string;
  regionText: string;
  stageText: string;
  writtenExamText: string;
}

export interface StudyView {
  gate: StudyGate;
  /** 第一层：一句话结论 */
  conclusion: string;
  target: StudyTargetBrief | null;
  /** 今天只做这一件（门禁未过时为 null） */
  todayTask: TodayTaskBrief | null;
  /** 第二层说明：7 天计划为何还没出现（不生成虚假计划） */
  weekPlanNote: string;
}

function findTarget(
  follows: FollowedOpportunity[],
  announcements: RecruitmentAnnouncement[],
): { follow: FollowedOpportunity; announcement: RecruitmentAnnouncement } | null {
  const primary = follows.find(
    (f) =>
      f.role === "primary" &&
      f.status !== "abandoned" &&
      f.status !== "closed",
  );
  if (!primary) return null;
  const announcement = announcements.find((a) => a.id === primary.announcementId);
  if (!announcement) return null;
  return { follow: primary, announcement };
}

export function buildStudyView(
  follows: FollowedOpportunity[],
  announcements: RecruitmentAnnouncement[],
): StudyView {
  const found = findTarget(follows, announcements);

  if (!found) {
    return {
      gate: "no_primary",
      conclusion: "先从你关注的机会里选一个主要备考目标",
      target: null,
      todayTask: null,
      weekPlanNote: "确定主要目标并核对考情后，才会生成 7 天安排；在此之前不做计划。",
    };
  }

  const { announcement } = found;
  const version = currentVersion(announcement);
  const unit =
    version.units.find((u) => u.id === found.follow.unitId) ?? version.units[0];

  const target: StudyTargetBrief = {
    unitId: unit.id,
    unitName: unit.name,
    regionText: regionLabel(unit.region),
    stageText: stageLabel(unit.stage),
    writtenExamText: version.timeline.writtenExamDate
      ? dateWithWeekday(version.timeline.writtenExamDate)
      : "待官方通知",
  };

  // 骨架阶段：主要目标已选，但考情核对流程在模块 7 接入；
  // 统一给“信息查找任务”，不伪造已核对的科目/分值计划。
  const task: TodayTaskBrief = {
    title: "在官方公告中核对考试科目、分值与笔试时间",
    materials: announcement.officialUrl,
    durationMinutes: 15,
    doneWhen: "把考试科目、各科分值和笔试时间记录到目标，确认与公告原文一致",
    whyFirst: "考情未核对前不会生成备考安排，先确认考什么才不会复习错方向",
    officialUrl: announcement.officialUrl,
  };

  return {
    gate: "exam_unverified",
    conclusion: `今天只做这一件：核对「${target.regionText}${target.stageText}」的考情`,
    target,
    todayTask: task,
    weekPlanNote: "考情核对完成后，7 天主题与逐日任务将在此出现（后续版本接入）。",
  };
}
