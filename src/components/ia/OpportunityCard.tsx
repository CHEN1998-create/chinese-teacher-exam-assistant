"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import type { DimensionView, OpportunityRow } from "@/lib/ia/opportunities-view";
import { MatchStatusTag, ClosedTag } from "./MatchStatusTag";

/**
 * 机会卡（IA 第 4.1 节内容预算：最多 6 项 + 1 个行动）：
 * 地区/报考单元 · 用工性质/学段 · 招聘人数 · 匹配状态（文字）· 截止时间 · 一句话依据。
 * 第二、三层在同一卡内渐进展开，不做 card 套 card；无阴影，仅靠边框分区。
 */

const DIMENSION_VALUE_META: Record<
  DimensionView["value"],
  { text: string; symbol: string; className: string }
> = {
  PASS: { text: "已满足", symbol: "✓", className: "text-emerald-700" },
  UNKNOWN: { text: "信息不足，补充后判断", symbol: "?", className: "text-amber-700" },
  MANUAL_REVIEW: { text: "存在歧义，建议向招聘单位确认", symbol: "!", className: "text-amber-700" },
  FAIL: { text: "不满足", symbol: "×", className: "text-red-700" },
};

interface OpportunityCardProps {
  row: OpportunityRow;
  expanded: boolean;
  onToggle: () => void;
  priority?: boolean;
}

export function OpportunityCard({ row, expanded, onToggle, priority = false }: OpportunityCardProps) {
  const panelId = useId();
  const closed = row.gateReason !== null;

  return (
    <article
      className={cn(
        "rounded-xl border bg-white",
        priority ? "border-blue-300" : "border-slate-200",
      )}
    >
      <h3 className="sr-only">{row.unitName}</h3>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="block w-full p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 rounded-t-xl"
      >
        {/* 第 1 行：地区 + 状态（均有文字） */}
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-sm font-semibold text-slate-900">
            <span className="text-slate-500 font-normal">{row.regionText}</span>
            <span className="mx-1.5 text-slate-300" aria-hidden="true">|</span>
            <span className="break-words">{row.unitName}</span>
          </p>
          {closed ? <ClosedTag /> : <MatchStatusTag status={row.status} />}
        </div>

        {/* 第 2 行：用工性质/学段 · 招聘人数 */}
        <p className="mt-2 text-sm text-slate-600">
          {row.natureText} · {row.stageText} · 招 {row.headcount} 人
        </p>

        {/* 第 3 行：截止时间 / 闸门原因 */}
        <p className={cn("mt-1 text-sm", row.registrationClosed ? "text-slate-400" : "text-slate-600")}>
          {closed ? row.gateReason : `报名${row.deadline}`}
        </p>

        {/* 第 4 行：一句话依据 */}
        <p className="mt-2 text-sm text-slate-500 line-clamp-2">{row.oneLineReason}</p>

        <p className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-700">
          {expanded ? "收起依据" : "查看依据与下一步"}
          <svg
            aria-hidden="true"
            className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </p>
      </button>

      {expanded && (
        <div id={panelId} className="border-t border-slate-200 px-4 py-3">
          {/* 第二层：逐项条件（主要依据与风险） */}
          <p className="text-xs font-semibold text-slate-500">条件核对</p>
          <ul className="mt-2 divide-y divide-slate-100">
            {row.dimensions.map((dim) => {
              const meta = DIMENSION_VALUE_META[dim.value];
              return (
                <li key={`${row.unitId}-${dim.label}`} className="py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-700">{dim.label}</span>
                    <span className={cn("inline-flex shrink-0 items-center gap-1 text-xs font-medium", meta.className)}>
                      <span aria-hidden="true">{meta.symbol}</span>
                      {meta.text}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{dim.reason}</p>
                </li>
              );
            })}
          </ul>

          {/* 第三层：完整来源与细节 */}
          <p className="mt-3 text-xs font-semibold text-slate-500">官方来源与核对</p>
          <dl className="mt-1.5 space-y-1 text-xs text-slate-500">
            <div className="flex gap-2">
              <dt className="shrink-0">发布单位</dt>
              <dd>{row.publisher}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0">核对时间</dt>
              <dd>{row.checkedAtText}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0">公告原文</dt>
              <dd>
                <a
                  href={row.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 underline underline-offset-2"
                >
                  打开官方公告（新窗口）
                </a>
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] text-slate-400">演示数据：字段以官方公告为准，正式环境以已审核发布版本为准。</p>
        </div>
      )}
    </article>
  );
}
