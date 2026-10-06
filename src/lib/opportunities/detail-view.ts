/**
 * 机会详情视图模型（纯函数，模块 5，PRD 7.4 三层结构）。
 *
 * 第一层结论与“下一步”由 nextAction 唯一决定（每个状态只有一个主行动）；
 * 第二层把逐条件结果分为已满足 / 待确认（UNKNOWN+MANUAL_REVIEW）/ 不满足；
 * 第三层（证据、版本、纠错）直接渲染 DTO，不在此加工。
 */
import type {
  DimensionDTO,
  GateDTO,
  MatchValue,
  UnitMatchDTO,
} from "./api-types";

export interface DimensionGroups {
  satisfied: DimensionDTO[];
  /** UNKNOWN（补信息）与 MANUAL_REVIEW（人工确认）合并为“待确认”，但各自标记可区分 */
  toConfirm: DimensionDTO[];
  unsatisfied: DimensionDTO[];
}

export function groupDimensions(dimensions: DimensionDTO[]): DimensionGroups {
  const groups: DimensionGroups = {
    satisfied: [],
    toConfirm: [],
    unsatisfied: [],
  };
  for (const dimension of dimensions) {
    if (dimension.value === "PASS") groups.satisfied.push(dimension);
    else if (dimension.value === "FAIL") groups.unsatisfied.push(dimension);
    else groups.toConfirm.push(dimension);
  }
  return groups;
}

export function failedGates(gates: GateDTO[]): GateDTO[] {
  return gates.filter((g) => !g.passed);
}

/**
 * 下一步行动类型：
 * - official：查看官方公告（已截止/无报名入口时的出口）
 * - follow：关注（收藏，进入考虑中）
 * - prepare：考虑中 → 准备报名
 * - register：前往官方报名入口
 * - supplement：补充缺失信息后重新判断
 * - confirm：向招聘单位人工确认
 * - waiting：准备报名中，等待官方开放报名入口
 * - registered：已报名，关注后续考试安排
 * - reviewFail：查看明确不符合项
 */
export type NextActionKind =
  | "official"
  | "follow"
  | "prepare"
  | "register"
  | "supplement"
  | "confirm"
  | "waiting"
  | "registered"
  | "reviewFail";

export interface NextAction {
  kind: NextActionKind;
  label: string;
  href?: string;
  external?: boolean;
}

export function nextAction(unit: UnitMatchDTO): NextAction {
  const closed = failedGates(unit.gates);
  if (closed.length > 0) {
    // 不同降级原因给不同出口文案，但主行动都是「回到官方依据」，
    // 不允许在待复核/预告/来源失效时出现「报名」「准备」行动
    const code = closed[0]!.code;
    const labelByCode: Record<string, string> = {
      registration_unconfirmed:
        "官方尚未公布报名时间：查看公告原文并等待官方通知",
      announcement_withdrawn: "公告已取消或撤回：查看官方留档与版本记录",
      source_unavailable: "官方来源暂时无法访问：查看公告留档",
      evidence_not_reviewed: "记录尚待人工复核：先查看官方公告原文",
      evidence_stale: "记录已超过复核时限：先查看官方公告原文",
      registration_closed: "报名已截止：查看公告留档与版本记录",
      out_of_scope_nature: "用工性质不在收录范围：查看官方公告",
      no_official_source: "缺少已核对的官方依据：查看官方公告",
      subject_not_open: "该岗位不面向当前开放学科：查看官方公告",
    };
    return {
      kind: "official",
      label: labelByCode[code] ?? "查看官方公告留档与版本记录",
      href: unit.announcement.officialUrl,
      external: true,
    };
  }

  switch (unit.overall) {
    case "need_more_info":
      return { kind: "supplement", label: "补充缺失信息后重新判断" };
    case "manual_review":
      return { kind: "confirm", label: "查看需要向招聘单位确认的条件" };
    case "not_eligible":
      return { kind: "reviewFail", label: "查看明确不符合的条件" };
    case "preliminary_eligible": {
      const follow = unit.follow;
      if (!follow) {
        return { kind: "follow", label: "关注这个机会（先加入考虑中）" };
      }
      if (follow.status === "considering") {
        return { kind: "prepare", label: "标记为准备报名" };
      }
      if (follow.status === "preparing") {
        return unit.unit.registerUrl
          ? {
              kind: "register",
              label: "前往官方报名入口完成报名",
              href: unit.unit.registerUrl,
              external: true,
            }
          : { kind: "waiting", label: "已在准备报名：等待官方开放报名入口" };
      }
      if (follow.status === "registered") {
        return { kind: "registered", label: "已报名：关注笔试与资格复审安排" };
      }
      if (follow.status === "abandoned") {
        return { kind: "follow", label: "重新纳入考虑" };
      }
      // closed（公告结束）落到官方出口
      return {
        kind: "official",
        label: "该机会已结束：查看官方公告",
        href: unit.announcement.officialUrl,
        external: true,
      };
    }
  }
}

/** 条件四值的展示元信息（文字 + 符号 + 颜色，绝不只靠颜色） */
export const DIMENSION_VALUE_META: Record<
  MatchValue,
  { text: string; symbol: string; className: string }
> = {
  PASS: { text: "已满足", symbol: "✓", className: "text-emerald-700" },
  UNKNOWN: {
    text: "信息不足，补充后判断",
    symbol: "?",
    className: "text-amber-700",
  },
  MANUAL_REVIEW: {
    text: "存在歧义，建议向招聘单位确认",
    symbol: "!",
    className: "text-amber-700",
  },
  FAIL: { text: "不满足", symbol: "×", className: "text-red-700" },
};
