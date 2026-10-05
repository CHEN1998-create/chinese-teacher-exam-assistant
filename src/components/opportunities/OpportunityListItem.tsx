"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import {
  deadlineText,
  natureShortLabel,
  regionLabel,
  stageLabel,
} from "@/lib/ia/labels";
import { ClosedTag, MatchStatusTag } from "@/components/ia/MatchStatusTag";
import type { UnitMatchDTO } from "@/lib/opportunities/api-types";
import {
  FOLLOW_STATUS_LABELS,
  STUDY_TARGET_ROLE_LABELS,
} from "@/lib/opportunities";
import { ConditionRows } from "./ConditionRows";

interface OpportunityListItemProps {
  unit: UnitMatchDTO;
  /** 评估时间（截止文案的参照时间，由后端 meta.evaluatedAt 提供） */
  evaluatedAt: string;
  priority?: boolean;
  defaultExpanded?: boolean;
  /** 关注/取消关注（卡片上的快捷操作）；缺省时只展示关注状态 */
  onToggleFollow?: (unit: UnitMatchDTO) => void;
  followBusy?: boolean;
}

/**
 * 机会列表卡片：第 1 层摘要（地区/单元/状态/截止/一句话依据）+
 * 展开后的条件核对简版；完整三层结构在详情页。
 * 标题与“查看详情”均跳转详情，不嵌套交互元素。
 */
export function OpportunityListItem({
  unit,
  evaluatedAt,
  priority = false,
  defaultExpanded = false,
  onToggleFollow,
  followBusy = false,
}: OpportunityListItemProps) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const closedGate = unit.gates.find((g) => !g.passed);
  const deadline = deadlineText(
    unit.version.timeline.registrationEnd,
    evaluatedAt,
  );
  const follow = unit.follow;

  return (
    <article
      className={cn(
        "rounded-xl border bg-white",
        priority ? "border-blue-300" : "border-slate-200",
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/opportunities/${unit.unit.id}`}
            className="min-w-0 text-sm font-semibold text-slate-900 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 rounded"
          >
            <span className="font-normal text-slate-500">
              {regionLabel(unit.unit.region)}
            </span>
            <span className="mx-1.5 text-slate-300" aria-hidden="true">
              |
            </span>
            <span className="break-words">{unit.unit.name}</span>
          </Link>
          {closedGate ? <ClosedTag /> : <MatchStatusTag status={unit.overall} />}
        </div>

        <p className="mt-2 text-sm text-slate-600">
          {natureShortLabel(unit.unit.employmentNature.code as never)} ·{" "}
          {stageLabel(unit.unit.stage)} · 招 {unit.unit.headcount} 人
        </p>

        <p
          className={cn(
            "mt-1 text-sm",
            closedGate || deadline.closed ? "text-slate-400" : "text-slate-600",
          )}
        >
          {closedGate ? closedGate.reason : `报名${deadline.text}`}
        </p>

        <p className="mt-2 line-clamp-2 text-sm text-slate-500">
          {unit.summary}
        </p>

        {follow && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
              {FOLLOW_STATUS_LABELS[follow.status]}
            </span>
            {follow.role && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                {follow.role === "primary" ? "★ " : ""}
                {STUDY_TARGET_ROLE_LABELS[follow.role]}
              </span>
            )}
            {follow.newerVersion && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                公告有新版本
              </span>
            )}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={panelId}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 rounded"
          >
            {expanded ? "收起条件核对" : "展开条件核对"}
            <svg
              aria-hidden="true"
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                expanded && "rotate-180",
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            {onToggleFollow && (
              <button
                type="button"
                onClick={() => onToggleFollow(unit)}
                disabled={followBusy}
                className="text-xs font-medium text-slate-600 hover:text-blue-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 rounded"
              >
                {follow ? "取消关注" : "关注"}
              </button>
            )}
            <Link
              href={`/opportunities/${unit.unit.id}`}
              className="text-xs font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 rounded"
            >
              查看详情
            </Link>
          </div>
        </div>
      </div>

      {expanded && (
        <div
          id={panelId}
          className="border-t border-slate-200 px-4 py-2"
          aria-label="条件核对"
        >
          <ConditionRows dimensions={unit.dimensions} />
          <p className="py-2 text-[11px] text-slate-400">
            完整依据、官方原文与版本信息见详情页。
          </p>
        </div>
      )}
    </article>
  );
}
