import { describe, expect, it } from "vitest";
import type { GoalDTO, GoalsResponse } from "@/lib/opportunities/api-types";
import { buildMyProgressView } from "./progress-view";

function goal(overrides: Partial<GoalDTO> = {}): GoalDTO {
  return {
    unitId: "unit-1",
    unitName: "杭州市教师招聘",
    unitCode: "A01",
    region: { code: "330100", province: "浙江省", city: "杭州市" },
    stage: "middle",
    subject: "chinese",
    headcount: 2,
    announcement: {
      id: "announcement-1",
      title: "示例公告",
      publisher: "教育局",
      officialUrl: "https://example.gov.cn/a",
    },
    version: {
      id: "version-1",
      versionNumber: 1,
      publishedAt: "2026-10-01T00:00:00+08:00",
      timeline: { registrationEnd: "2026-10-18T18:00:00+08:00" },
    },
    role: "backup",
    followStatus: "considering",
    followedAt: "2026-10-08T00:00:00+08:00",
    newerVersion: false,
    ...overrides,
  };
}

describe("buildMyProgressView", () => {
  it("没有保存机会时，引导去看机会而不是展示设置入口", () => {
    const view = buildMyProgressView({ goals: [], primaryTargetUnitId: null });
    expect(view.conclusion).toBe("还没有保存机会");
    expect(view.actionHref).toBe("/opportunities");
    expect(view.actionVariant).toBe("outline");
  });

  it("已经保存但未选重点时，引导选择重点机会", () => {
    const view = buildMyProgressView(
      { goals: [goal()], primaryTargetUnitId: null },
      "2026-10-08T00:00:00+08:00",
    );
    expect(view.savedCount).toBe(1);
    expect(view.actionLabel).toBe("选择重点机会");
    expect(view.nearestDeadline).toBe("2026年10月18日");
  });

  it("已有重点机会时，首屏只推动继续备考", () => {
    const primary = goal({ role: "primary" });
    const data: GoalsResponse = { goals: [primary], primaryTargetUnitId: primary.unitId };
    const view = buildMyProgressView(data, "2026-10-08T00:00:00+08:00");
    expect(view.conclusion).toContain(primary.unitName);
    expect(view.actionLabel).toBe("继续备考");
    expect(view.actionHref).toBe("/study");
  });
});
