"use client";

import { useState } from "react";
import { EVIDENCE_SOURCE_TYPE_LABELS, ExtractionJob } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, ExtractionJobBadge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";

interface ExtractionJobPanelProps {
  /** 当前目标最新一个提取任务；null 表示从未提交 */
  job: ExtractionJob | null;
  /** 历史任务（最新任务之前的） */
  history: ExtractionJob[];
  busy: boolean;
  onRetry: (jobId: string) => void;
}

/** 提取流程状态：未提交 / 正在提取 / 提取成功 / 提取失败 / 待人工审核 */
export function ExtractionJobPanel({ job, history, busy, onRetry }: ExtractionJobPanelProps) {
  if (!job) {
    return (
      <Card className="bg-slate-50/60 border-dashed">
        <div className="flex items-start gap-3">
          <span className="text-xl" aria-hidden>🗂️</span>
          <div>
            <p className="text-sm font-medium text-slate-700">尚未提交公告</p>
            <p className="text-xs text-slate-500 mt-1">
              提交公告链接或正文后，这里会显示提取进度、失败原因与重试入口。
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{job.sourceLabel}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {EVIDENCE_SOURCE_TYPE_LABELS[job.sourceType]} · 提交于{" "}
              {new Date(job.createdAt).toLocaleString("zh-CN", { hour12: false })}
            </p>
          </div>
          <ExtractionJobBadge status={job.status} />
        </div>

        {job.status === "processing" && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <span
                className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin shrink-0"
                aria-hidden
              />
              <span>{job.stage ?? "正在提取"}…</span>
              <span className="text-xs text-slate-400 ml-auto">{job.progress}%</span>
            </div>
            <Progress value={job.progress} size="sm" />
            <p className="text-xs text-slate-400">
              提取在本地模拟进行，期间请勿关闭页面；刷新页面会将任务标记为中断失败。
            </p>
          </div>
        )}

        {job.status === "failed" && (
          <div className="mt-4 space-y-3">
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="font-medium">提取失败</p>
              <p className="mt-1 text-red-600">{job.failReason ?? "未知原因"}</p>
            </div>
            <Button size="sm" onClick={() => onRetry(job.id)} disabled={busy}>
              {busy ? "正在重新提取…" : "重新提取"}
            </Button>
          </div>
        )}

        {job.status === "succeeded" && (
          <div className="mt-4 space-y-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              ✅ 提取成功，共识别 {job.extractedCount ?? 0} 个字段，暂无高影响字段需要逐条审核。
              可在“这次考试怎么考”中查看每条结论的来源与状态。
            </div>
          </div>
        )}

        {job.status === "pending_review" && (
          <div className="mt-4 space-y-2">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-medium">提取成功，{job.pendingReviewCount ?? 0} 个字段待人工审核</p>
              <p className="mt-1 text-amber-700">
                报名/考试时间、科目、分值、资格条件等高影响字段已提取，但在人工审核完成前只会显示
                <Badge variant="warning" className="mx-1">待审核</Badge>
                ，不会标记为“已从官方公告核对”。
              </p>
            </div>
          </div>
        )}
      </Card>

      {history.length > 0 && <JobHistory history={history} busy={busy} onRetry={onRetry} />}
    </div>
  );
}

function JobHistory({
  history,
  busy,
  onRetry,
}: {
  history: ExtractionJob[];
  busy: boolean;
  onRetry: (jobId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="bg-slate-50/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-sm font-medium text-slate-700">历史提交（{history.length}）</span>
        <span className="text-xs text-slate-400">{open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <ul className="mt-3 space-y-2">
          {history.map((j) => (
            <li key={j.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs text-slate-700 truncate">{j.sourceLabel}</p>
                <p className="text-[11px] text-slate-400">
                  {new Date(j.createdAt).toLocaleString("zh-CN", { hour12: false })}
                  {j.failReason ? ` · ${j.failReason}` : ""}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-2">
                <ExtractionJobBadge status={j.status} />
                {j.status === "failed" && (
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onRetry(j.id)}>
                    重试
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
