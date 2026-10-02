"use client";

import { useState } from "react";
import { PlanTask, TaskFeedback, IncompleteReason, INCOMPLETE_REASON_LABELS } from "@/types";
import { feedbackService, DuplicateFeedbackError } from "@/lib/plans/feedbackService";

interface QuickFeedbackPanelProps {
  task: PlanTask;
  /** 提交成功后回调，页面展示下一项任务 */
  onSubmitted: (status: TaskFeedback["status"]) => void;
}

/**
 * 一分钟点选式快速反馈（v5.1）：
 * - 三个主操作：我做完了 / 做了一部分 / 今天没做；
 * - 「做完了」一次点击即完成提交；其余两种先点选一个简短原因再提交（最多三次点击）；
 * - 保存失败时保留已选状态，可直接重试；
 * - 重复提交由 service 层拦截兜底。
 */
export function QuickFeedbackPanel({ task, onSubmitted }: QuickFeedbackPanelProps) {
  const [pendingStatus, setPendingStatus] = useState<"partial" | "not_completed" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (
    status: TaskFeedback["status"],
    incompleteReason?: IncompleteReason
  ): void => {
    setSaving(true);
    setError(null);
    try {
      const result = feedbackService.submit(task.id, {
        status,
        actualTime: status === "completed" ? task.estimatedTime : undefined,
        incompleteReason,
        errorTypes: [],
        hasSecondPractice: false,
      });
      onSubmitted(result.status);
    } catch (e) {
      if (e instanceof DuplicateFeedbackError) {
        // 已有反馈（极端并发）：视为成功，页面会展示已有反馈摘要
        onSubmitted(e.existing.status);
      } else {
        // 保存失败：保留当前选择，可点重试
        setError(e instanceof Error ? `保存失败：${e.message}` : "保存失败，请重试");
      }
    } finally {
      setSaving(false);
    }
  };

  const reasonChips = (
    <div className="mt-3">
      <p className="text-xs text-slate-500 mb-2">选一个最接近的原因（选完即保存）</p>
      <div className="flex flex-wrap gap-2">
        {(Object.entries(INCOMPLETE_REASON_LABELS) as [IncompleteReason, string][]).map(
          ([key, label]) => (
            <button
              key={key}
              type="button"
              disabled={saving}
              onClick={() => submit(pendingStatus!, key)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              {label}
            </button>
          )
        )}
      </div>
      <button
        type="button"
        onClick={() => setPendingStatus(null)}
        className="mt-2 text-xs text-slate-400 hover:text-slate-600"
      >
        返回重新选择
      </button>
    </div>
  );

  return (
    <div>
      {!pendingStatus && (
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => submit("completed")}
            className="h-11 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            我做完了
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setPendingStatus("partial")}
            className="h-11 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            做了一部分
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setPendingStatus("not_completed")}
            className="h-11 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            今天没做
          </button>
        </div>
      )}

      {pendingStatus && reasonChips}

      {error && (
        <div role="alert" className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">{error}</p>
          <p className="text-xs text-red-500 mt-1">
            你的选择已保留，检查网络或存储后
            <button
              type="button"
              className="underline ml-1"
              onClick={() =>
                pendingStatus ? setError(null) : submit("completed")
              }
            >
              点击重试
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
