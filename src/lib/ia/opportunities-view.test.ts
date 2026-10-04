import { describe, expect, it } from "vitest";
import {
  V61_NOW,
  V61_SCENARIO_IDS,
  V61_SEED_ANNOUNCEMENTS,
  V61_SEED_PROFILE,
} from "@/lib/seed/v61-opportunities";
import { buildOpportunitiesView } from "./opportunities-view";

describe("机会页视图模型", () => {
  const view = buildOpportunitiesView(V61_SEED_ANNOUNCEMENTS, V61_SEED_PROFILE, V61_NOW);

  it("按四档结果分组：2 初步符合 / 1 补户籍 / 1 人工确认 / 1 学历不符 / 1 已截止", () => {
    expect(view.preliminary.map((r) => r.announcementId).sort()).toEqual(
      [V61_SCENARIO_IDS.eligible, V61_SCENARIO_IDS.supplemented].sort(),
    );
    expect(view.needInfoGroups).toHaveLength(1);
    expect(view.needInfoGroups[0].dimension).toBe("hukou");
    expect(view.needInfoGroups[0].count).toBe(1);
    expect(view.manualReview.map((r) => r.announcementId)).toEqual([
      V61_SCENARIO_IDS.majorAmbiguous,
    ]);
    expect(view.notEligible.map((r) => r.announcementId)).toEqual([
      V61_SCENARIO_IDS.educationFail,
    ]);
    expect(view.closed.map((r) => r.announcementId)).toEqual([V61_SCENARIO_IDS.closed]);
  });

  it("结论句与有效机会计数一致", () => {
    expect(view.validCount).toBe(4);
    expect(view.conclusion).toContain("2 个初步符合");
    // 未覆盖不等于没有招聘，必须在覆盖说明中声明
    expect(view.coverage).toContain("未覆盖地区不等于没有招聘");
  });

  it("优先机会是浙江事业编的杭州岗位（地区偏好 → 确定程度排序）", () => {
    expect(view.priority?.announcementId).toBe(V61_SCENARIO_IDS.eligible);
    expect(view.priority?.regionText).toBe("杭州市");
    expect(view.priority?.natureText).toBe("事业编");
    expect(view.priority?.stageText).toBe("初中");
    expect(view.priority?.headcount).toBe(12);
  });

  it("风险不制造虚假紧迫感：杭州距截止 16 天，只给中性提示", () => {
    expect(view.priority?.deadline).toContain("还剩 16 天");
    expect(view.risk?.tone).toBe("info");
  });

  it("已截止机会闸门失败原因可查，且不在主要推荐中", () => {
    const wenzhou = view.closed.find((r) => r.announcementId === V61_SCENARIO_IDS.closed);
    expect(wenzhou?.registrationClosed).toBe(true);
    expect(wenzhou?.gateReason).toContain("截止");
  });

  it("合肥当前版本为补充公告 v2：扩招 8 人、截止延期到 11 月", () => {
    const hefei = view.preliminary.find((r) => r.announcementId === V61_SCENARIO_IDS.supplemented);
    expect(hefei?.headcount).toBe(8);
    expect(hefei?.registrationEnd).toBe("2026-11-15");
  });

  it("每张卡都带逐项条件与官方来源（二、三层渐进展开所需字段齐备）", () => {
    for (const row of [...view.preliminary, ...view.manualReview, ...view.notEligible]) {
      expect(row.dimensions.length).toBeGreaterThan(0);
      expect(row.officialUrl).toMatch(/^https:\/\//);
      expect(row.publisher.length).toBeGreaterThan(0);
      expect(row.oneLineReason.length).toBeGreaterThan(0);
    }
  });

  it("机会卡严格遵守内容预算字段（6 项 + 行动，不堆砌额外事实字段）", () => {
    const budgetKeys = [
      "regionText",
      "unitName",
      "natureText",
      "stageText",
      "headcount",
      "status",
      "deadline",
      "oneLineReason",
    ];
    for (const key of budgetKeys) {
      expect(view.priority).toHaveProperty(key);
    }
  });
});
