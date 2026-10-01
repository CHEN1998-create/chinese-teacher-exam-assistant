"use client";

import { useState } from "react";
import { PlanTask, TaskFeedback, TaskFeedbackInput } from "@/types";
import { TaskCard } from "@/components/ui/TaskCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FeedbackForm } from "@/components/ui/FeedbackForm";
import { FeedbackSummary } from "./FeedbackSummary";
import { feedbackService, DuplicateFeedbackError } from "@/lib/plans/feedbackService";

interface TodayTaskItemProps {
  task: PlanTask;
  feedback: TaskFeedback | null;
  /** 当天为最低可完成日时，第一项任务标记为最低可完成任务 */
  isMinimumViableTask?: boolean;
  /** 提交/修改成功后回调，用于展示下一步提示 */
  onSubmitted: (status: TaskFeedback["status"]) => void;
}

type Mode = "closed" | "create" | "edit";

/**
 * 今日任务 + 执行反馈的交互单元。
 * 内部消化：表单开合、保存中、保存失败（保留输入可重试）、重复提交拦截。
 */
export function TodayTaskItem({ task, feedback, isMinimumViableTask, onSubmitted }: TodayTaskItemProps) {
  const [mode, setMode] = useState<Mode>("closed");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (input: TaskFeedbackInput): void => {
    setSaving(true);
    setError(null);
    try {
      const result =
        mode === "edit" && feedback
          ? feedbackService.update(feedback.id, input)
          : feedbackService.submit(task.id, input);
      setMode("closed");
      onSubmitted(result.status);
    } catch (e) {
      if (e instanceof DuplicateFeedbackError) {
        // 极端并发下的兜底：提示并收起表单，已有反馈摘要会自动展示
        setError(null);
        setMode("closed");
      } else {
        setError(e instanceof Error ? `保存失败：${e.message}，请重试。` : "保存失败，请重试。");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        {isMinimumViableTask && <Badge variant="warning">最低可完成任务</Badge>}
      </div>
      <TaskCard task={task} showPlanMeta showFeedback={false} />

      {feedback && mode !== "edit" && (
        <FeedbackSummary feedback={feedback} onEdit={() => setMode("edit")} />
      )}

      {mode === "create" && (
        <FeedbackForm
          task={task}
          saving={saving}
          error={error}
          onSubmit={handleSubmit}
          onCancel={() => {
            setMode("closed");
            setError(null);
          }}
        />
      )}

      {mode === "edit" && (
        <FeedbackForm
          task={task}
          initial={feedback}
          saving={saving}
          error={error}
          onSubmit={handleSubmit}
          onCancel={() => {
            setMode("closed");
            setError(null);
          }}
        />
      )}

      {!feedback && mode === "closed" && (
        <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setMode("create")}>
          提交执行反馈
        </Button>
      )}
    </div>
  );
}
