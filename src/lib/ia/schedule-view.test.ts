import { describe, expect, it } from "vitest";
import {
  V61_NOW,
  V61_SEED_ANNOUNCEMENTS,
  V61_SEED_FOLLOWS,
} from "@/lib/seed/v61-opportunities";
import type { FollowedOpportunity } from "@/lib/opportunities/types";
import { buildScheduleView } from "./schedule-view";

describe("日程页视图模型", () => {
  const view = buildScheduleView(V61_SEED_FOLLOWS, V61_SEED_ANNOUNCEMENTS, V61_NOW);

  it("只为已关注的机会生成时间线（未关注不产生提醒）", () => {
    expect(view.groups).toHaveLength(1);
    expect(view.groups[0].unitId).toBe("unit-hangzhou-01");
  });

  it("时间线包含报名开始/截止、笔试与待官方通知事项", () => {
    const kinds = view.groups[0].events.map((e) => e.kind);
    expect(kinds).toEqual([
      "registration_start",
      "registration_end",
      "written_exam",
      "pending_notice",
    ]);
  });

  it("已过去的报名开始节点标记 past；待定事项不显示推测日期", () => {
    const start = view.groups[0].events.find((e) => e.kind === "registration_start");
    const pending = view.groups[0].events.find((e) => e.kind === "pending_notice");
    expect(start?.past).toBe(true);
    expect(pending?.pending).toBe(true);
    expect(pending?.dateIso).toBeNull();
    expect(pending?.dateText).toBe("待官方通知");
  });

  it("下一件不能错过的事 = 报名截止（必须处理，优先于笔试备考），且带报名入口行动", () => {
    expect(view.next?.event.kind).toBe("registration_end");
    expect(view.next?.event.urgency).toBe("must");
    expect(view.next?.event.dateIso).toBe("2026-10-20");
    expect(view.next?.event.action?.label).toBe("去报名入口");
    expect(view.next?.event.action?.external).toBe(true);
    expect(view.next?.groupTitle).toContain("杭州");
  });

  it("笔试节点的下一步回到备考页", () => {
    const written = view.groups[0].events.find((e) => e.kind === "written_exam");
    expect(written?.action?.href).toBe("/study");
  });

  it("没有任何关注时给空态输入：next 为 null、分组为空（不制造虚假提醒）", () => {
    const empty = buildScheduleView([], V61_SEED_ANNOUNCEMENTS, V61_NOW);
    expect(empty.next).toBeNull();
    expect(empty.groups).toEqual([]);
  });

  it("已放弃/已结束的关注不进入日程", () => {
    const abandoned: FollowedOpportunity[] = [
      { ...V61_SEED_FOLLOWS[0], status: "abandoned" },
    ];
    const result = buildScheduleView(abandoned, V61_SEED_ANNOUNCEMENTS, V61_NOW);
    expect(result.groups).toHaveLength(0);
    expect(result.next).toBeNull();
  });
});
