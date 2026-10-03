import { describe, it, expect } from "vitest";
import {
  EvidenceItem,
  ExamTarget,
  ResourceItem,
} from "@/types";
import { GuestAnswers } from "./guestSession";
import { buildFirstResult, findMatchedTarget } from "./previewEngine";

const NOW = "2026-03-01T09:00:00.000Z";
const URL1 = "https://edu.hangzhou.gov.cn/2026/announce.html";

function target(partial: Partial<ExamTarget>): ExamTarget {
  return {
    id: "et-1",
    userId: "u-1",
    name: "杭州市2026年上半年初中语文统招",
    region: "浙江省杭州市",
    regionCode: "330100",
    subject: "chinese",
    stage: "preparation",
    status: "confirmed",
    targetStatus: "announcement",
    isCurrent: true,
    province: "浙江省",
    city: "杭州市",
    educationLevel: "middle",
    year: 2026,
    batch: "上半年统招",
    examType: "public_school",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    ...partial,
  };
}

function evidence(partial: Partial<EvidenceItem>): EvidenceItem {
  return {
    id: "ev-1",
    examTargetId: "et-1",
    field: "subjects",
    value: "教育教学理论、语文学科专业知识",
    reviewStatus: "official",
    sourceName: "杭州市教育局2026年招聘公告",
    sourceType: "announcement_url",
    sourceUrl: URL1,
    scope: "浙江省杭州市 · 2026年上半年统招 · 初中语文",
    updatedAt: "2026-02-05T00:00:00.000Z",
    version: 1,
    ...partial,
  };
}

function nationalResource(partial: Partial<ResourceItem> = {}): ResourceItem {
  return {
    id: "r-1",
    title: "义务教育语文课程标准（2022年版）",
    resourceType: "official",
    sourceName: "教育部官网",
    sourceUrl: "http://www.moe.gov.cn/kebiao.html",
    rightsStatus: "official",
    applicableRegions: ["全国"],
    applicableLevels: ["primary", "middle", "high"],
    applicableTypes: ["public_school"],
    modules: ["mod_kebiao"],
    recommendReason: "官方课程标准，全国通用",
    suggestedChapters: ["课程性质与基本理念"],
    estimatedMinutes: 40,
    lastReviewedAt: "2026-02-01T00:00:00.000Z",
    linkAlive: true,
    status: "active",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    ...partial,
  };
}

const baseAnswers: GuestAnswers = {
  province: "浙江省",
  city: "杭州市",
  educationLevel: "middle",
  dailyAvailableMinutes: 45,
};

describe("findMatchedTarget 严格匹配", () => {
  it("地区+学段一致：唯一精确匹配", () => {
    const m = findMatchedTarget(baseAnswers, [target({})]);
    expect(m?.level).toBe("exact");
  });

  it("同省不同城市：不能精确匹配（也不套用同省其他考试）", () => {
    const m = findMatchedTarget(
      { ...baseAnswers, city: "温州市" },
      [target({ id: "et-hz" })]
    );
    // 同省有目标 → province_only，只能作为未支持提示
    expect(m?.level).toBe("province_only");
  });

  it("同省同市不同学段：不能精确匹配", () => {
    const m = findMatchedTarget(
      { ...baseAnswers, educationLevel: "high" },
      [target({ educationLevel: "middle" })]
    );
    expect(m?.level).toBe("province_only");
  });

  it("同地区同学段存在多个候选（批次不同）：不能精确匹配", () => {
    const m = findMatchedTarget(baseAnswers, [
      target({ id: "et-a", batch: "上半年统招" }),
      target({ id: "et-b", batch: "提前批招聘" }),
    ]);
    expect(m?.level).toBe("province_only");
  });

  it("只有已归档目标：不匹配", () => {
    const m = findMatchedTarget(baseAnswers, [
      target({ status: "archived" }),
    ]);
    expect(m).toBeNull();
  });
});

describe("安排有依据：来源与核对状态闸门", () => {
  it("精确匹配 + 关键字段已核对且来源可查看：supported，任务针对这场考试", () => {
    const r = buildFirstResult(
      baseAnswers,
      [target({})],
      [evidence({})],
      [],
      NOW
    );
    expect(r.supportStatus).toBe("supported");
    expect(r.todayTask.kind).toBe("study");
    expect(r.todayTask.executable).toBe(true);
    expect(r.todayTask.material?.url).toBe(URL1);
  });

  it("已核对但缺来源链接：不能算已核对结论，也不能称为针对这场考试的安排", () => {
    const r = buildFirstResult(
      baseAnswers,
      [target({})],
      [evidence({ sourceUrl: undefined, sourceName: "来源不明" })],
      [nationalResource()],
      NOW
    );
    expect(r.supportStatus).toBe("unsupported");
    expect(r.confirmedFacts).toHaveLength(0);
    // 精确匹配但未核对 → 信息查找任务，而不是学习/定制任务
    expect(r.todayTask.kind).toBe("info_find");
    expect(r.todayTask.executable).toBe(false);
  });

  it("来源链接不是合法可打开链接（含占位/example 失效）：降级为未支持", () => {
    const r = buildFirstResult(
      baseAnswers,
      [target({})],
      [evidence({ sourceUrl: "not-a-url" })],
      [],
      NOW
    );
    expect(r.supportStatus).toBe("unsupported");
    expect(r.confirmedFacts.map((f) => f.label)).not.toContain("考试科目");
  });

  it("待核对状态（pending_review）不能冒充已核对结论", () => {
    const r = buildFirstResult(
      baseAnswers,
      [target({})],
      [evidence({ reviewStatus: "pending_review" })],
      [nationalResource()],
      NOW
    );
    expect(r.supportStatus).toBe("unsupported");
    expect(r.confirmedFacts).toHaveLength(0);
  });
});

describe("未支持考试：通用起步建议", () => {
  it("精确匹配但未核对：第一项是信息查找任务，不可执行，不编造当地科目", () => {
    const r = buildFirstResult(
      baseAnswers,
      [target({})],
      [],
      [],
      NOW
    );
    expect(r.todayTask.kind).toBe("info_find");
    expect(r.todayTask.executable).toBe(false);
    expect(r.todayTask.completionCriteria).toContain("招聘公告");
  });

  it("无匹配：任务明确标注通用起步建议，有合规全国资源时带可打开入口", () => {
    const r = buildFirstResult(
      { ...baseAnswers, province: "江苏省", city: "南京市" },
      [target({ id: "et-hz" })],
      [evidence({})],
      [nationalResource()],
      NOW
    );
    expect(r.supportStatus).toBe("unsupported");
    expect(r.todayTask.kind).toBe("general_starter");
    expect(r.todayTask.generalAdvice).toBe(true);
    expect(r.todayTask.executable).toBe(true);
    expect(r.todayTask.material?.url).toBe("http://www.moe.gov.cn/kebiao.html");
  });

  it("无匹配且无合规资源：通用建议不可执行，不编造资料", () => {
    const r = buildFirstResult(
      { ...baseAnswers, province: "江苏省", city: "南京市" },
      [target({})],
      [],
      [],
      NOW
    );
    expect(r.todayTask.generalAdvice).toBe(true);
    expect(r.todayTask.executable).toBe(false);
    expect(r.todayTask.material).toBeUndefined();
  });

  it("同省不同学段提示语明确写出不能套用", () => {
    const r = buildFirstResult(
      { ...baseAnswers, educationLevel: "high" },
      [target({ educationLevel: "middle" })],
      [evidence({})],
      [nationalResource()],
      NOW
    );
    expect(r.supportNote).toContain("不能直接套用");
  });
});
