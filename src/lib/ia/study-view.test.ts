import { describe, expect, it } from "vitest";
import {
  V61_SEED_ANNOUNCEMENTS,
  V61_SEED_FOLLOWS,
} from "@/lib/seed/v61-opportunities";
import { buildStudyView } from "./study-view";

describe("备考页视图模型（门禁）", () => {
  it("未选择主要目标：第一层给下一步，不生成今日任务与周计划", () => {
    const view = buildStudyView(V61_SEED_FOLLOWS, V61_SEED_ANNOUNCEMENTS);
    expect(view.gate).toBe("no_primary");
    expect(view.todayTask).toBeNull();
    expect(view.target).toBeNull();
    expect(view.conclusion).toContain("主要备考目标");
    expect(view.weekPlanNote).toContain("主要目标");
  });

  it("已选主要目标但考情未核对：今天只做信息查找任务，不编造科目计划", () => {
    const follows = [
      { ...V61_SEED_FOLLOWS[0], role: "primary" as const },
    ];
    const view = buildStudyView(follows, V61_SEED_ANNOUNCEMENTS);
    expect(view.gate).toBe("exam_unverified");
    expect(view.target?.unitId).toBe("unit-hangzhou-01");
    expect(view.target?.writtenExamText).toContain("11月8日");
    expect(view.todayTask).not.toBeNull();
    // 五要素齐备
    expect(view.todayTask?.title).toContain("核对");
    expect(view.todayTask?.materials).toMatch(/^https:\/\//);
    expect(view.todayTask?.durationMinutes).toBeGreaterThan(0);
    expect(view.todayTask?.doneWhen.length).toBeGreaterThan(0);
    expect(view.todayTask?.whyFirst.length).toBeGreaterThan(0);
    // 周计划仍为空，说明原因
    expect(view.weekPlanNote).toContain("7 天");
  });

  it("已放弃的关注不能充当主要目标", () => {
    const follows = [
      { ...V61_SEED_FOLLOWS[0], role: "primary" as const, status: "abandoned" as const },
    ];
    const view = buildStudyView(follows, V61_SEED_ANNOUNCEMENTS);
    expect(view.gate).toBe("no_primary");
    expect(view.todayTask).toBeNull();
  });
});
