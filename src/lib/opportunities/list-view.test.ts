import { describe, expect, it } from "vitest";
import type { MatchResponse, UnitMatchDTO } from "./api-types";
import { buildListViewModel, formatEvaluatedAt } from "./list-view";

function makeUnit(
  unitId: string,
  overall: UnitMatchDTO["overall"],
  extra: Partial<UnitMatchDTO> = {},
): UnitMatchDTO {
  return {
    unit: {
      id: unitId,
      code: unitId,
      name: unitId,
      region: { code: "330100", province: "浙江省", city: "杭州市" },
      stage: "middle",
      headcount: 1,
      organizationType: "government_unified",
      employmentNature: {
        code: "public_institution_staff",
        officialName: "事业编制工作人员",
      },
      allocation: { code: "direct_school", description: "" },
    },
    announcement: {
      id: `ann-${unitId}`,
      title: unitId,
      publisher: "教育局",
      organizationType: "government_unified",
      officialUrl: "https://example.gov.cn/a",
    },
    version: {
      id: `ann-${unitId}-v1`,
      versionNumber: 1,
      sourceKind: "original",
      publishedAt: "2026-09-28T09:00:00+08:00",
      timeline: {
        registrationStart: "2026-10-01",
        registrationEnd: "2026-10-20",
      },
      officialSource: {
        id: "src",
        locator: { kind: "url", url: "https://example.gov.cn/a" },
        state: "official",
        checkedAt: "2026-10-04T12:00:00+08:00",
      },
    },
    gates: [
      { code: "subject_not_open", passed: true, reason: "" },
      { code: "registration_closed", passed: true, reason: "" },
      { code: "out_of_scope_nature", passed: true, reason: "" },
      { code: "announcement_withdrawn", passed: true, reason: "" },
      { code: "no_official_source", passed: true, reason: "" },
    ],
    dimensions: [],
    overall,
    summary: "",
    follow: null,
    ...extra,
  };
}

function makeResponse(
  units: Record<string, UnitMatchDTO>,
  primaryTargetUnitId: string | null = null,
): MatchResponse {
  return {
    meta: {
      ruleVersion: "kb-match-rules-1.1.0",
      majorAliasVersion: "kb-major-aliases-1.0.0",
      catalogVersion: "kb-opportunity-catalog-1.0.0",
      evaluatedAt: "2026-10-05T10:00:00+08:00",
    },
    primaryTargetUnitId,
    groups: {
      preliminary: [units.hangzhou!, units.hefei!].filter(Boolean),
      needInfo: units.yinzhou
        ? [
            {
              dimension: "hukou",
              count: 1,
              units: [units.yinzhou],
            },
          ]
        : [],
      manualReview: units.suzhou ? [units.suzhou] : [],
      notEligible: units.nanjing ? [units.nanjing] : [],
      closed: units.wenzhou ? [units.wenzhou] : [],
    },
    follows: [],
  };
}

describe("buildListViewModel：四类结果的列表叙事", () => {
  it("六场景分组正确：杭州/合肥初步符合、鄞州待补户籍、苏州人工确认、南京不符合、温州已截止", () => {
    const closedWenzhou = makeUnit("unit-wenzhou-01", "preliminary_eligible", {
      gates: [
        { code: "subject_not_open", passed: true, reason: "" },
        {
          code: "registration_closed",
          passed: false,
          reason: "报名已于 2026-09-20 截止",
        },
        { code: "out_of_scope_nature", passed: true, reason: "" },
        { code: "announcement_withdrawn", passed: true, reason: "" },
        { code: "no_official_source", passed: true, reason: "" },
      ],
    });
    const response = makeResponse({
      hangzhou: makeUnit("unit-hangzhou-01", "preliminary_eligible"),
      hefei: makeUnit("unit-hefei-01-v2", "preliminary_eligible"),
      yinzhou: makeUnit("unit-yinzhou-01", "need_more_info"),
      suzhou: makeUnit("unit-suzhou-01", "manual_review"),
      nanjing: makeUnit("unit-nanjing-01", "not_eligible"),
      wenzhou: closedWenzhou,
    });

    const view = buildListViewModel(response);
    expect(view.priority?.unit.id).toBe("unit-hangzhou-01");
    expect(view.otherPreliminary.map((u) => u.unit.id)).toEqual([
      "unit-hefei-01-v2",
    ]);
    expect(view.needInfoGroups[0]?.dimension).toBe("hukou");
    expect(view.needInfoGroups[0]?.units[0]?.unit.id).toBe(
      "unit-yinzhou-01",
    );
    expect(view.manualReview.map((u) => u.unit.id)).toEqual(["unit-suzhou-01"]);
    expect(view.notEligible.map((u) => u.unit.id)).toEqual(["unit-nanjing-01"]);
    expect(view.closed.map((u) => u.unit.id)).toEqual(["unit-wenzhou-01"]);
    expect(view.validCount).toBe(4);
    expect(view.excludedCount).toBe(2);
    expect(view.conclusion).toContain("2 个初步符合");
    expect(view.conclusion).toContain("1 个待补充信息");
    expect(view.conclusion).toContain("1 个建议人工确认");
  });

  it("主要备考目标是初步符合之一时，它成为第一屏优先机会", () => {
    const response = makeResponse(
      {
        hangzhou: makeUnit("unit-hangzhou-01", "preliminary_eligible"),
        hefei: makeUnit("unit-hefei-01-v2", "preliminary_eligible"),
      },
      "unit-hefei-01-v2",
    );
    const view = buildListViewModel(response);
    expect(view.priority?.unit.id).toBe("unit-hefei-01-v2");
    expect(view.otherPreliminary.map((u) => u.unit.id)).toEqual([
      "unit-hangzhou-01",
    ]);
  });

  it("无初步符合但有待补充时，结论引导补信息且没有优先卡", () => {
    const response = makeResponse({
      yinzhou: makeUnit("unit-yinzhou-01", "need_more_info"),
    });
    const view = buildListViewModel(response);
    expect(view.priority).toBeNull();
    expect(view.otherPreliminary).toHaveLength(0);
    expect(view.conclusion).toContain("补充 1 个机会");
  });

  it("已截止机会不计入有效机会数", () => {
    const response = makeResponse({
      wenzhou: makeUnit("unit-wenzhou-01", "preliminary_eligible", {
        gates: [
          { code: "subject_not_open", passed: true, reason: "" },
          {
            code: "registration_closed",
            passed: false,
            reason: "已截止",
          },
          { code: "out_of_scope_nature", passed: true, reason: "" },
          { code: "announcement_withdrawn", passed: true, reason: "" },
          { code: "no_official_source", passed: true, reason: "" },
        ],
      }),
    });
    const view = buildListViewModel(response);
    expect(view.validCount).toBe(0);
    expect(view.closed).toHaveLength(1);
  });

  it("评估时间格式化为月日时分", () => {
    const text = formatEvaluatedAt("2026-10-05T10:00:00+08:00");
    expect(text).toContain("10月5日");
    expect(text).toMatch(/\d{2}:\d{2}/);
  });
});
