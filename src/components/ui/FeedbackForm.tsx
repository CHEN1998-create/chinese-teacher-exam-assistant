"use client";

import { useState } from "react";
import {
  CompletionStatus,
  ErrorCategory,
  IncompleteReason,
  PlanTask,
  TaskFeedback,
  TaskFeedbackInput,
  COMPLETION_STATUS_LABELS,
  ERROR_TYPE_LABELS,
  INCOMPLETE_REASON_LABELS,
} from "@/types";
import { Card } from "./Card";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

interface FeedbackFormProps {
  task: PlanTask;
  /** 已有反馈时进入"修改"模式（保留首次提交时间） */
  initial?: TaskFeedback | null;
  saving?: boolean;
  error?: string | null;
  onSubmit: (input: TaskFeedbackInput) => void;
  onCancel?: () => void;
}

const STATUS_OPTIONS: { value: CompletionStatus; label: string; activeClass: string }[] = [
  { value: "completed", label: "完成", activeClass: "bg-emerald-600 text-white border-emerald-600" },
  { value: "partial", label: "部分完成", activeClass: "bg-amber-500 text-white border-amber-500" },
  {
    value: "not_completed",
    label: "未完成",
    activeClass: "bg-rose-600 text-white border-rose-600",
  },
];

const ERROR_CATEGORIES: ErrorCategory[] = [
  "knowledge_gap",
  "misunderstanding",
  "structure_unclear",
  "time_management",
  "careless",
  "material_unsuitable",
  "other",
];

const INCOMPLETE_REASONS: IncompleteReason[] = ["time", "difficulty", "material", "mood", "other"];

/**
 * 一分钟反馈表单：
 * 完成情况三选一 → 实际用时（默认带出预计时间）→ 未完成原因/错因点选 →
 * 二次练习勾选 → 补充说明选填。除补充说明外全部点选，无需打字。
 */
export function FeedbackForm({ task, initial, saving, error, onSubmit, onCancel }: FeedbackFormProps) {
  const [status, setStatus] = useState<CompletionStatus>(initial?.status ?? "completed");
  const [actualTime, setActualTime] = useState<number>(initial?.actualTime ?? task.estimatedTime);
  const [incompleteReason, setIncompleteReason] = useState<IncompleteReason | "">(
    initial?.incompleteReason ?? ""
  );
  const [errorTypes, setErrorTypes] = useState<ErrorCategory[]>(initial?.errorTypes ?? []);
  const [hasSecondPractice, setHasSecondPractice] = useState(initial?.hasSecondPractice ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const toggleErrorType = (type: ErrorCategory): void => {
    setErrorTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = (): void => {
    onSubmit({
      status,
      actualTime: actualTime > 0 ? actualTime : undefined,
      incompleteReason: status !== "completed" ? incompleteReason || undefined : undefined,
      errorTypes,
      hasSecondPractice,
      notes,
    });
  };

  return (
    <Card className="mt-3 border-blue-200 bg-blue-50/30">
      <h4 className="font-medium text-slate-900 mb-1">
        {initial ? "修改反馈" : "提交执行反馈"}：{task.title}
      </h4>
      <p className="text-xs text-slate-500 mb-4">约一分钟即可完成，点选为主，补充说明选填。</p>

      {/* 完成情况 */}
      <fieldset className="mb-4">
        <legend className="block text-sm font-medium text-slate-700 mb-2">完成情况</legend>
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatus(opt.value)}
              className={cn(
                "flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                status === opt.value
                  ? opt.activeClass
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
              )}
            >
              {COMPLETION_STATUS_LABELS[opt.value]}
            </button>
          ))}
        </div>
      </fieldset>

      {/* 实际用时 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          实际用时（分钟）
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActualTime((v) => Math.max(0, v - 15))}
            className="w-9 h-9 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            aria-label="减少15分钟"
          >
            −15
          </button>
          <input
            type="number"
            value={actualTime}
            onChange={(e) => setActualTime(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="w-24 h-9 px-2 rounded-lg border border-slate-300 bg-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            min={0}
            step={5}
          />
          <button
            type="button"
            onClick={() => setActualTime((v) => v + 15)}
            className="w-9 h-9 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            aria-label="增加15分钟"
          >
            +15
          </button>
          <span className="text-xs text-slate-400">预计 {task.estimatedTime} 分钟</span>
        </div>
      </div>

      {/* 未完成原因：仅部分完成 / 未完成时显示 */}
      {status !== "completed" && (
        <fieldset className="mb-4">
          <legend className="block text-sm font-medium text-slate-700 mb-2">
            未完成/部分完成原因
          </legend>
          <div className="flex flex-wrap gap-2">
            {INCOMPLETE_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => setIncompleteReason(reason)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm border transition-colors",
                  incompleteReason === reason
                    ? "bg-rose-100 text-rose-700 border-rose-300"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                )}
              >
                {INCOMPLETE_REASON_LABELS[reason]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {/* 主要错因（多选，可留空） */}
      <fieldset className="mb-4">
        <legend className="block text-sm font-medium text-slate-700 mb-2">
          主要错因（可多选，无错因可不选）
        </legend>
        <div className="flex flex-wrap gap-2">
          {ERROR_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleErrorType(cat)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm border transition-colors",
                errorTypes.includes(cat)
                  ? "bg-amber-100 text-amber-700 border-amber-300"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
              )}
            >
              {ERROR_TYPE_LABELS[cat]}
            </button>
          ))}
        </div>
      </fieldset>

      {/* 二次练习 */}
      <div className="mb-4 flex items-center gap-2">
        <input
          type="checkbox"
          id={`second-practice-${task.id}`}
          checked={hasSecondPractice}
          onChange={(e) => setHasSecondPractice(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor={`second-practice-${task.id}`} className="text-sm text-slate-700">
          已完成二次练习
        </label>
      </div>

      {/* 补充说明（选填） */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          补充说明（选填）
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="例如：文言文实词需要再背一轮……"
          className="w-full min-h-[64px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="mb-3 p-2.5 bg-rose-50 text-rose-700 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex gap-3 justify-end">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            取消
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? "保存中…" : initial ? "保存修改" : "提交反馈"}
        </Button>
      </div>
    </Card>
  );
}
