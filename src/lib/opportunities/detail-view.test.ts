import { describe, expect, it } from "vitest";
import type { DimensionDTO, FollowDTO, UnitMatchDTO } from "./api-types";
import {
  DIMENSION_VALUE_META,
  failedGates,
  groupDimensions,
  nextAction,
} from "./detail-view";

function dimension(
  dimension: DimensionDTO["dimension"],
  value: DimensionDTO["value"],
): DimensionDTO {
  return {
    requirementId: dimension,
    dimension,
    value,
    reason: `${dimension}-${value}`,
    hard: true,
    requirementDescription: "公告原文表述",
    evidence: {
      id: "ev",
      locator: { kind: "url", url: "https://example.gov.cn/a" },
      state: "official",
      checkedAt: "2026-10-04T12:00:00+08:00",
    },
  };
}

function makeUnit(overrides: Partial<UnitMatchDTO> = {}): UnitMatchDTO {
  return {
    unit: {
      id: "unit-hangzhou-01",
      code: "HZ",
      name: "杭州初中语文岗位组",
      region: { code: "330100", province: "浙江省", city: "杭州市" },
      stage: "middle",
      headcount: 12,
      organizationType: "government_unified",
      employmentNature: {
        code: "public_institution_staff",
        officialName: "事业编制",
      },
      allocation: { code: "direct_school", description: "" },
      registerUrl: "https://example.gov.cn/apply",
    },
    announcement: {
      id: "ann-hangzhou",
      title: "杭州公告",
      publisher: "杭州市教育局",
      organizationType: "government_unified",
      officialUrl: "https://example.gov.cn/a",
      dataset: "demo",
      reviewStatus: "human_reviewed",
      reviewedBy: null,
      reviewedAt: null,
    },
    version: {
      id: "ann-hangzhou-v1",
      versionNumber: 1,
      sourceKind: "original",
      publishedAt: "2026-09-28T09:00:00+08:00",
      timeline: { registrationStart: "2026-10-01", registrationEnd: "2026-10-20" },
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
    overall: "preliminary_eligible",
    summary: "",
    follow: null,
    ...overrides,
  };
}

function follow(overrides: Partial<FollowDTO> = {}): FollowDTO {
  return {
    id: "f1",
    unitId: "unit-hangzhou-01",
    announcementId: "ann-hangzhou",
    versionId: "ann-hangzhou-v1",
    status: "considering",
    role: null,
    followedAt: "2026-10-04T12:30:00+08:00",
    statusHistory: [
      { status: "considering", at: "2026-10-04T12:30:00+08:00" },
    ],
    abandonReason: null,
    newerVersion: false,
    ...overrides,
  };
}

describe("groupDimensions：第二层三组划分", () => {
  it("PASS → 已满足；UNKNOWN/MANUAL_REVIEW → 待确认；FAIL → 不满足", () => {
    const groups = groupDimensions([
      dimension("education", "PASS"),
      dimension("hukou", "UNKNOWN"),
      dimension("major", "MANUAL_REVIEW"),
      dimension("degree", "FAIL"),
    ]);
    expect(groups.satisfied.map((d) => d.dimension)).toEqual(["education"]);
    expect(groups.toConfirm.map((d) => d.dimension)).toEqual([
      "hukou",
      "major",
    ]);
    expect(groups.unsatisfied.map((d) => d.dimension)).toEqual(["degree"]);
  });
});

describe("failedGates：闸门失败提取", () => {
  it("只返回未通过的闸门", () => {
    const failed = failedGates([
      { code: "subject_not_open", passed: true, reason: "" },
      { code: "registration_closed", passed: false, reason: "已截止" },
    ]);
    expect(failed).toHaveLength(1);
    expect(failed[0]?.code).toBe("registration_closed");
  });
});

describe("nextAction：第一层唯一下一步", () => {
  it("初步符合且未关注 → 关注（收藏不等于准备报名）", () => {
    expect(nextAction(makeUnit()).kind).toBe("follow");
  });

  it("考虑中 → 标记准备报名；准备报名中且有报名入口 → 官方报名", () => {
    expect(
      nextAction(makeUnit({ follow: follow({ status: "considering" }) })).kind,
    ).toBe("prepare");
    expect(
      nextAction(makeUnit({ follow: follow({ status: "preparing" }) })),
    ).toMatchObject({ kind: "register", href: "https://example.gov.cn/apply" });
  });

  it("已报名 → 关注考试安排；放弃后 → 重新纳入考虑", () => {
    expect(
      nextAction(makeUnit({ follow: follow({ status: "registered" }) })).kind,
    ).toBe("registered");
    expect(
      nextAction(makeUnit({ follow: follow({ status: "abandoned" }) })).kind,
    ).toBe("follow");
  });

  it("需要补充信息 → supplement；建议人工确认 → confirm；明确不符合 → reviewFail", () => {
    expect(nextAction(makeUnit({ overall: "need_more_info" })).kind).toBe(
      "supplement",
    );
    expect(nextAction(makeUnit({ overall: "manual_review" })).kind).toBe(
      "confirm",
    );
    expect(nextAction(makeUnit({ overall: "not_eligible" })).kind).toBe(
      "reviewFail",
    );
  });

  it("闸门失败（已截止）→ 只给官方公告出口，不出现报名动作", () => {
    const action = nextAction(
      makeUnit({
        gates: [
          { code: "subject_not_open", passed: true, reason: "" },
          { code: "registration_closed", passed: false, reason: "已截止" },
          { code: "out_of_scope_nature", passed: true, reason: "" },
          { code: "announcement_withdrawn", passed: true, reason: "" },
          { code: "no_official_source", passed: true, reason: "" },
        ],
      }),
    );
    expect(action.kind).toBe("official");
    expect(action.href).toBe("https://example.gov.cn/a");
  });

  it("四种条件值都有文字标签（不只靠颜色）", () => {
    for (const value of ["PASS", "UNKNOWN", "MANUAL_REVIEW", "FAIL"] as const) {
      expect(DIMENSION_VALUE_META[value].text.length).toBeGreaterThan(0);
      expect(DIMENSION_VALUE_META[value].symbol.length).toBeGreaterThan(0);
    }
  });
});
