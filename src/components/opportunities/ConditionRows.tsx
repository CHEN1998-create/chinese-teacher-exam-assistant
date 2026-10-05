"use client";

import { cn } from "@/lib/utils";
import { dimensionLabel } from "@/lib/ia/labels";
import type { DimensionDTO } from "@/lib/opportunities/api-types";
import { DIMENSION_VALUE_META } from "@/lib/opportunities/detail-view";

/**
 * 逐条件结果行（详情第二层 / 列表卡片展开态共用）。
 * 只渲染后端返回的 value/reason/公告原文表述，前端不做任何再判定。
 */
export function ConditionRows({
  dimensions,
  showDescription = false,
}: {
  dimensions: DimensionDTO[];
  /** 详情页展示公告原文表述；列表卡片只展示短结论 */
  showDescription?: boolean;
}) {
  return (
    <ul className="divide-y divide-slate-100">
      {dimensions.map((dim) => {
        const meta = DIMENSION_VALUE_META[dim.value];
        return (
          <li key={dim.requirementId} className="py-2.5">
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-medium text-slate-700">
                {dim.dimension === "region"
                  ? "就业地区"
                  : dimensionLabel(dim.dimension)}
              </span>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 text-xs font-medium",
                  meta.className,
                )}
              >
                <span aria-hidden="true">{meta.symbol}</span>
                {meta.text}
              </span>
            </div>
            {showDescription && dim.requirementDescription && (
              <p className="mt-1 text-xs text-slate-500">
                <span className="text-slate-400">公告原文：</span>
                {dim.requirementDescription}
              </p>
            )}
            <p className="mt-0.5 text-xs text-slate-500">{dim.reason}</p>
          </li>
        );
      })}
    </ul>
  );
}
