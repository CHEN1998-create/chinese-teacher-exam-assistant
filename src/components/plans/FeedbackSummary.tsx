"use client";

import {
  TaskFeedback,
  COMPLETION_STATUS_LABELS,
  ERROR_TYPE_LABELS,
  INCOMPLETE_REASON_LABELS,
} from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDateTime, formatTime } from "@/lib/utils";

const STATUS_VARIANT = {
  completed: "success",
  partial: "warning",
  not_completed: "danger",
} as const;

interface FeedbackSummaryProps {
  feedback: TaskFeedback;
  /** 是否允许修改（今日页面允许，历史只读场景可关闭） */
  editable?: boolean;
  onEdit?: () => void;
}

/** 已提交反馈的只读摘要：完成状态/用时/原因/错因/二次练习/说明 + 更新时间 */
export function FeedbackSummary({ feedback, editable = true, onEdit }: FeedbackSummaryProps) {
  const edited = feedback.updatedAt && feedback.updatedAt !== feedback.createdAt;

  return (
    <div className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-slate-700">执行反馈</span>
        <Badge variant={STATUS_VARIANT[feedback.status]}>
          {COMPLETION_STATUS_LABELS[feedback.status]}
        </Badge>
        {feedback.actualTime !== undefined && (
          <span className="text-xs text-slate-500">
            实际用时 {formatTime(feedback.actualTime)}
          </span>
        )}
        {feedback.hasSecondPractice && <Badge variant="info">已二次练习</Badge>}
      </div>

      {feedback.incompleteReason && (
        <div className="flex gap-2 text-sm">
          <span className="shrink-0 text-slate-400">原因：</span>
          <span className="text-slate-600">
            {INCOMPLETE_REASON_LABELS[feedback.incompleteReason]}
          </span>
        </div>
      )}

      {feedback.errorTypes.length > 0 && (
        <div className="flex gap-2 items-start text-sm">
          <span className="shrink-0 text-slate-400">错因：</span>
          <div className="flex flex-wrap gap-1">
            {feedback.errorTypes.map((type) => (
              <span
                key={type}
                className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded border border-amber-200"
              >
                {ERROR_TYPE_LABELS[type]}
              </span>
            ))}
          </div>
        </div>
      )}

      {feedback.notes && (
        <div className="flex gap-2 text-sm">
          <span className="shrink-0 text-slate-400">说明：</span>
          <span className="text-slate-600 whitespace-pre-wrap">{feedback.notes}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-xs text-slate-400">
          {edited
            ? `已修改 · 更新于 ${formatDateTime(feedback.updatedAt)}`
            : `提交于 ${formatDateTime(feedback.createdAt)}`}
        </span>
        {editable && onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            修改反馈
          </Button>
        )}
      </div>
    </div>
  );
}
