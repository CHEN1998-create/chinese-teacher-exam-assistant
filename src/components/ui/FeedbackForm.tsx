"use client";

import { useState } from "react";
import { TaskFeedback, ErrorType, ERROR_TYPE_LABELS } from "@/types";
import { Card } from "./Card";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/auth";

interface FeedbackFormProps {
  taskId: string;
  taskTitle: string;
  onSubmit: (feedback: Omit<TaskFeedback, "id" | "createdAt">) => void;
  onCancel?: () => void;
}

const statusOptions = [
  { value: "completed", label: "完成", variant: "success" as const },
  { value: "partial", label: "部分完成", variant: "warning" as const },
  { value: "not_completed", label: "未完成", variant: "danger" as const },
];

const errorTypeOptions: { value: ErrorType; label: string }[] = [
  { value: "knowledge_gap", label: ERROR_TYPE_LABELS.knowledge_gap },
  { value: "misunderstanding", label: ERROR_TYPE_LABELS.misunderstanding },
  { value: "structure_unclear", label: ERROR_TYPE_LABELS.structure_unclear },
  { value: "time_management", label: ERROR_TYPE_LABELS.time_management },
  { value: "careless", label: ERROR_TYPE_LABELS.careless },
  { value: "material_unsuitable", label: ERROR_TYPE_LABELS.material_unsuitable },
  { value: "other", label: ERROR_TYPE_LABELS.other },
];

const incompleteReasons = [
  { value: "time", label: "时间不够" },
  { value: "difficulty", label: "内容太难" },
  { value: "material", label: "资料不合适" },
  { value: "mood", label: "状态不好" },
  { value: "other", label: "其他" },
];

export function FeedbackForm({ taskId, taskTitle, onSubmit, onCancel }: FeedbackFormProps) {
  const { user } = useCurrentUser();
  const [status, setStatus] = useState<"completed" | "partial" | "not_completed">("completed");
  const [actualTime, setActualTime] = useState<number>(60);
  const [incompleteReason, setIncompleteReason] = useState<string>("");
  const [errorTypes, setErrorTypes] = useState<ErrorType[]>([]);
  const [hasSecondPractice, setHasSecondPractice] = useState(false);
  const [notes, setNotes] = useState("");

  const toggleErrorType = (type: ErrorType) => {
    setErrorTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = () => {
    onSubmit({
      taskId,
      userId: user?.id ?? "anonymous",
      status,
      actualTime,
      incompleteReason: status !== "completed" ? (incompleteReason as TaskFeedback["incompleteReason"]) : undefined,
      errorTypes,
      hasSecondPractice,
      notes: notes || undefined,
    });
  };

  return (
    <Card className="mt-4 border-blue-200 bg-blue-50/30">
      <h4 className="font-medium text-slate-900 mb-4">任务反馈：{taskTitle}</h4>

      {/* 完成状态 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">完成情况</label>
        <div className="flex gap-2">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatus(opt.value as typeof status)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                status === opt.value
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-300"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 实际用时 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          实际用时（分钟）
        </label>
        <input
          type="number"
          value={actualTime}
          onChange={(e) => setActualTime(parseInt(e.target.value) || 0)}
          className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          min={0}
        />
      </div>

      {/* 未完成原因 */}
      {status !== "completed" && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">未完成原因</label>
          <div className="flex flex-wrap gap-2">
            {incompleteReasons.map((reason) => (
              <button
                key={reason.value}
                type="button"
                onClick={() => setIncompleteReason(reason.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm transition-colors",
                  incompleteReason === reason.value
                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                    : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-50"
                )}
              >
                {reason.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 错因 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          主要错因（可多选）
        </label>
        <div className="flex flex-wrap gap-2">
          {errorTypeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleErrorType(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm transition-colors",
                errorTypes.includes(opt.value)
                  ? "bg-amber-100 text-amber-700 border border-amber-300"
                  : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-50"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 二次练习 */}
      <div className="mb-4 flex items-center gap-2">
        <input
          type="checkbox"
          id="secondPractice"
          checked={hasSecondPractice}
          onChange={(e) => setHasSecondPractice(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="secondPractice" className="text-sm text-slate-700">
          已完成二次练习
        </label>
      </div>

      {/* 备注 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">备注</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="记录一下今天的心得或问题..."
          className="w-full min-h-[80px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-3 justify-end">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button onClick={handleSubmit}>提交反馈</Button>
      </div>
    </Card>
  );
}
