"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ExamTarget, TARGET_STATUS_LABELS } from "@/types";
import { examTargetService } from "@/lib/services";
import { candidateLabel } from "@/lib/targets/domain";

interface ClarificationPanelProps {
  target: ExamTarget;
  /** 打开编辑表单补充信息 */
  onEdit: () => void;
}

/**
 * 信息不足时的澄清视图：
 * 已确定条件 / 待确认问题 / 1-3 个查找任务 / 候选方向确认。
 * 不展示任何精确复习比例或完整计划入口。
 */
export function ClarificationPanel({ target, onEdit }: ClarificationPanelProps) {
  const clarification = examTargetService.getClarification(target.id);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!clarification) return null;

  const doneCount = clarification.tasks.filter((t) => t.status === "done").length;

  // service 持久化后会通知订阅者，页面自动重读，无需手动回传刷新
  const guard = (fn: () => void) => {
    setBusy(true);
    setError(null);
    try {
      fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 状态说明条：图标+文字，不仅靠颜色 */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <span className="text-xl leading-none" aria-hidden>
          🧭
        </span>
        <div>
          <p className="text-sm font-medium text-amber-900">
            目标信息不足，正在澄清中（{TARGET_STATUS_LABELS[target.targetStatus]}）
          </p>
          <p className="text-sm text-amber-800 mt-1">
            完成下方查找任务或确认一个本周方向后，才能进入考情核验与计划生成。
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* 候选方向确认 */}
      {target.targetStatus === "candidates" && !target.confirmedCandidateId && (
        <Card>
          <CardHeader
            title="确认本周准备方向"
            description="先选一个候选方向主攻，其余候选保留为历史目标，之后可以切换"
          />
          <div className="space-y-2.5">
            {(target.candidates ?? []).filter((c) => c.province || c.city).map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {candidateLabel(c) || "未填写完整的候选"}
                  </p>
                  {c.note && <p className="text-xs text-slate-500 mt-0.5">{c.note}</p>}
                </div>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    guard(() => examTargetService.confirmCandidateDirection(target.id, c.id))
                  }
                >
                  确认为本周方向
                </Button>
              </div>
            ))}
            {(target.candidates ?? []).filter((c) => c.province || c.city).length === 0 && (
              <p className="text-sm text-slate-500">候选信息还是空的，请先“补充信息”填写候选地区。</p>
            )}
          </div>
        </Card>
      )}

      {/* 已确定条件 */}
      <Card>
        <CardHeader title="已确定条件" description="以下信息会被保留，无需重复填写" />
        {clarification.confirmedConditions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {clarification.confirmedConditions.map((c) => (
              <span
                key={c.label}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
              >
                <span aria-hidden>✓</span>
                {c.label}：{c.value}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">还没有确定的条件。</p>
        )}
      </Card>

      {/* 待确认问题 */}
      <Card>
        <CardHeader title="待确认问题" description="这些信息决定考什么、怎么安排复习" />
        <ul className="space-y-2">
          {clarification.pendingQuestions.map((q) => (
            <li key={q} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="mt-0.5 text-amber-500" aria-hidden>?</span>
              {q}
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={onEdit}>
            补充 / 修改信息
          </Button>
        </div>
      </Card>

      {/* 查找任务 */}
      <Card>
        <CardHeader
          title="查找任务"
          description={
            clarification.tasks.length > 0
              ? `本周内完成，已完成 ${doneCount}/${clarification.tasks.length}`
              : "暂无查找任务"
          }
        />
        <div className="space-y-2.5">
          {clarification.tasks.map((task) => {
            const checked = task.status === "done";
            return (
              <label
                key={task.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                  checked ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                  checked={checked}
                  onChange={(e) =>
                    guard(() =>
                      examTargetService.toggleClarificationTask(target.id, task.id, e.target.checked)
                    )
                  }
                />
                <span className="min-w-0">
                  <span
                    className={`block text-sm font-medium ${
                      checked ? "text-emerald-800 line-through" : "text-slate-900"
                    }`}
                  >
                    {task.title}
                  </span>
                  {task.description && (
                    <span className="mt-0.5 block text-xs text-slate-500">{task.description}</span>
                  )}
                  <span className="mt-1.5 inline-flex">
                    {checked ? <Badge variant="success">已完成</Badge> : <Badge variant="warning">{task.dueHint ?? "待完成"}</Badge>}
                  </span>
                </span>
              </label>
            );
          })}
          {clarification.tasks.length === 0 && (
            <p className="text-sm text-slate-500">没有需要查找的任务，可以直接补充信息确认目标。</p>
          )}
        </div>
      </Card>
    </div>
  );
}
