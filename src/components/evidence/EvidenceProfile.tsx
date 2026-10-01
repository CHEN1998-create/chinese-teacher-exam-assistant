"use client";

import { useEffect } from "react";
import {
  EVIDENCE_TYPE_LABELS,
  EvidenceItem,
  REVIEW_STATUS_LABELS,
  ReviewStatus,
} from "@/types";
import { Card } from "@/components/ui/Card";
import { ReviewStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";
import { PROFILE_GROUPS, ProfileRow, isHighImpact } from "@/lib/evidence/domain";
import { track, trackView } from "@/lib/analytics/eventService";

interface EvidenceProfileProps {
  rows: ProfileRow[];
  counts: Record<ReviewStatus, number> | null;
  targetId: string;
  onCorrect: (item: EvidenceItem) => void;
}

/** 考情画像：11 个结构化字段，逐条展示结论值/证据标签/原始来源/适用范围/更新时间/审核状态 */
export function EvidenceProfile({ rows, counts, targetId, onCorrect }: EvidenceProfileProps) {
  // 查看证据卡（同一会话只计一次），用于“证据卡查看率”
  useEffect(() => {
    trackView(targetId, "evidence_viewed", "evidence", { targetId });
  }, [targetId]);

  if (!counts) return null;

  const hasAnyConclusion = rows.some((r) => r.reviewStatus !== "unconfirmed");
  const hasConflict = rows.some((r) => r.hasConflict);
  const pendingHighImpact = rows.filter(
    (r) => isHighImpact(r.field) && r.reviewStatus === "pending_review"
  ).length;

  return (
    <div className="space-y-4">
      {/* 状态摘要：文字 + 数字，不仅靠颜色 */}
      <Card className="bg-slate-50/60">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <SummaryItem label="官方确认" count={counts.official} tone="text-emerald-700" />
          <SummaryItem label="AI已提取" count={counts.ai_extracted} tone="text-blue-700" />
          <SummaryItem label="待审核" count={counts.pending_review} tone="text-amber-700" />
          <SummaryItem
            label="历史/个人经验"
            count={counts.historical + counts.personal}
            tone="text-cyan-700"
          />
          <SummaryItem label="待确认" count={counts.unconfirmed} tone="text-slate-600" />
        </div>
        {pendingHighImpact > 0 && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠️ 有 {pendingHighImpact} 个高影响字段（时间/科目/分值/资格条件）处于“待审核”，
            未经人工审核不会标记为“官方确认”，请勿据此做最终决定。
          </p>
        )}
        {hasConflict && (
          <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            ⚠️ 检测到不同来源的结论冲突，冲突字段已标记，提交纠错或等待人工核对后再使用。
          </p>
        )}
      </Card>

      {!hasAnyConclusion && (
        <EmptyState
          icon={<span className="text-4xl">📭</span>}
          title="还没有考情证据"
          description="在“提交公告”中粘贴公告链接或正文，提取后这里会生成带来源与审核状态的结构化画像"
        />
      )}

      {PROFILE_GROUPS.map((group) => (
        <div key={group.key}>
          <h3 className="text-sm font-semibold text-slate-700 mb-2.5">
            {group.title}
            {group.key === "high_impact" && (
              <span className="ml-2 text-xs font-normal text-amber-600">高影响 · 逐条核对</span>
            )}
          </h3>
          <div className="space-y-2.5">
            {group.fields.map((field) => {
              const row = rows.find((r) => r.field === field);
              if (!row) return null;
              return <EvidenceRow key={field} row={row} targetId={targetId} onCorrect={onCorrect} />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryItem({ label, count, tone }: { label: string; count: number; tone: string }) {
  return (
    <span className={tone}>
      <span className="font-semibold">{count}</span> {label}
    </span>
  );
}

function EvidenceRow({
  row,
  targetId,
  onCorrect,
}: {
  row: ProfileRow;
  targetId: string;
  onCorrect: (item: EvidenceItem) => void;
}) {
  const missing = row.reviewStatus === "unconfirmed" || !row.value;
  const high = isHighImpact(row.field);
  // 仅展示与主结论实质不同的备选；同值不同源不构成冲突，不重复展示
  const differentAlternatives = row.alternatives.filter(
    (alt) => alt.value.trim() !== row.value.trim()
  );

  return (
    <Card
      padding="sm"
      className={
        row.hasConflict
          ? "border-red-300"
          : high && row.reviewStatus === "pending_review"
            ? "border-amber-300"
            : ""
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            {EVIDENCE_TYPE_LABELS[row.field]}
            {high && (
              <span className="px-1.5 py-px rounded bg-amber-100 text-amber-700 text-[10px] font-medium">
                高影响
              </span>
            )}
            {row.hasConflict && (
              <span className="px-1.5 py-px rounded bg-red-100 text-red-700 text-[10px] font-medium">
                来源冲突
              </span>
            )}
          </p>
          <p
            className={`mt-1 text-sm font-medium whitespace-pre-line ${
              missing ? "text-slate-400" : "text-slate-900"
            }`}
          >
            {missing
              ? row.hasConflict
                ? "待确认：该字段存在来源冲突，等待人工核实"
                : "待确认：尚未从任何来源提取到该信息"
              : row.value}
          </p>
        </div>
        <ReviewStatusBadge status={missing ? "unconfirmed" : row.reviewStatus} />
      </div>

      {!missing && (
        <div className="mt-2.5 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span>
              来源：<span className="text-slate-600">{row.sourceName || "未知来源"}</span>
              {row.sourceUrl && (
                <a
                  href={row.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-blue-600 hover:underline"
                  onClick={() =>
                    // 仅记录“打开了哪个字段的来源”，不记录 URL 本身
                    track("source_opened", "evidence", {
                      targetId,
                      props: { field: row.field },
                    })
                  }
                >
                  打开原始来源 ↗
                </a>
              )}
            </span>
            <span>适用范围：{row.scope}</span>
            <span>更新：{formatDate(row.updatedAt)}</span>
            {row.reviewedAt && (
              <span className="text-emerald-600">
                {row.reviewerName ? `${row.reviewerName} ` : ""}
                {formatDate(row.reviewedAt)} 人工确认
              </span>
            )}
          </div>
          {row.sourceExcerpt && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1.5 border-l-2 border-slate-200">
              原文摘录：{row.sourceExcerpt}
            </p>
          )}
          {differentAlternatives.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50/60 px-2.5 py-1.5 space-y-1">
              <p className="text-xs font-medium text-red-700">其他来源的不同结论：</p>
              {differentAlternatives.map((alt) => (
                <p key={alt.id} className="text-xs text-red-800">
                  · {alt.value}
                  <span className="ml-1 text-red-500">
                    （{alt.sourceName}，{REVIEW_STATUS_LABELS[alt.reviewStatus]}）
                  </span>
                </p>
              ))}
            </div>
          )}
          <div className="pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => onCorrect(row)}>
              提交纠错
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
