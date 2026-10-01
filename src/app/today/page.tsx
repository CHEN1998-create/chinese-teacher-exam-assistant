"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TaskCard } from "@/components/ui/TaskCard";
import { FeedbackForm } from "@/components/ui/FeedbackForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingPage } from "@/components/ui/Loading";
import { planService, examTargetService } from "@/lib/services";
import { canGeneratePlan } from "@/lib/targets/domain";
import { TaskFeedback } from "@/types";
import { formatDateWithWeekday, getGreeting } from "@/lib/utils";

export default function TodayPage() {
  const [isLoading] = useState(false);
  const [feedbackTaskId, setFeedbackTaskId] = useState<string | null>(null);
  const [showFeedbackSuccess, setShowFeedbackSuccess] = useState(false);

  const currentExam = examTargetService.getCurrent();
  const todayPlan = planService.getTodayPlan();

  // 如果没有今天的计划，使用10月1日的Mock数据
  const displayPlan = todayPlan || planService.getDayPlan("2026-10-01");

  const coreTasks = useMemo(() => {
    return displayPlan?.tasks.filter((t) => t.isCore) || [];
  }, [displayPlan]);

  const pendingTasks = useMemo(() => {
    return displayPlan?.tasks.filter(
      (t) => t.status === "pending" || t.status === "in_progress"
    ) || [];
  }, [displayPlan]);

  const completedTasks = useMemo(() => {
    return displayPlan?.tasks.filter(
      (t) => t.status === "completed" || t.status === "partial"
    ) || [];
  }, [displayPlan]);

  if (isLoading) return <LoadingPage />;

  if (!currentExam) {
    return (
      <EmptyState
        title="请先设置考试目标"
        description="在查看今日任务之前，需要先明确你的考试目标"
        actionLabel="开始目标澄清"
        actionHref="/onboarding"
      />
    );
  }

  // 与计划页同一门禁：目标未澄清时不展示精确任务
  if (!canGeneratePlan(currentExam)) {
    return (
      <EmptyState
        icon={<span className="text-5xl">🧭</span>}
        title="请先完成目标澄清"
        description="目标明确前不会安排每日精确任务。"
        actionLabel="去完成目标澄清"
        actionHref="/exam"
      />
    );
  }

  if (!displayPlan || displayPlan.tasks.length === 0) {
    return (
      <EmptyState
        title="今日暂无任务"
        description="可能是休息日，或者计划尚未生成"
        actionLabel="查看本周计划"
        actionHref="/plan"
      />
    );
  }

  const handleSubmitFeedback = (feedback: Omit<TaskFeedback, "id" | "createdAt">) => {
    planService.submitTaskFeedback(feedback.taskId, feedback);
    setFeedbackTaskId(null);
    setShowFeedbackSuccess(true);
    setTimeout(() => setShowFeedbackSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* 问候与概览 */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          {getGreeting()}，今天有 {pendingTasks.length} 项任务待完成
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {displayPlan ? formatDateWithWeekday(displayPlan.date) : ""} · 预计用时 {displayPlan.totalEstimatedTime} 分钟
        </p>
      </div>

      {/* 反馈成功提示 */}
      {showFeedbackSuccess && (
        <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-sm font-medium">
          反馈已提交，明天的计划会根据你的完成情况调整
        </div>
      )}

      {/* 核心任务 */}
      <Card>
        <CardHeader
          title="今日核心任务"
          description="这些是最重要、必须完成的学习任务"
          action={
            pendingTasks.length > 0 && (
              <Badge variant="primary">{pendingTasks.length} 项待完成</Badge>
            )
          }
        />
        <div className="space-y-3">
          {coreTasks.map((task) => (
            <div key={task.id}>
              <TaskCard task={task} />
              {/* 反馈入口 */}
              {task.status !== "completed" && feedbackTaskId !== task.id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => setFeedbackTaskId(task.id)}
                >
                  {task.status === "pending" ? "开始任务" : "提交反馈"}
                </Button>
              )}
              {feedbackTaskId === task.id && (
                <FeedbackForm
                  taskId={task.id}
                  taskTitle={task.title}
                  onSubmit={handleSubmitFeedback}
                  onCancel={() => setFeedbackTaskId(null)}
                />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* 非核心任务 */}
      {displayPlan.tasks.some((t) => !t.isCore) && (
        <Card>
          <CardHeader
            title="可选任务"
            description="有时间可以尝试，不影响核心进度"
          />
          <div className="space-y-3">
            {displayPlan.tasks
              .filter((t) => !t.isCore)
              .map((task) => (
                <TaskCard key={task.id} task={task} compact />
              ))}
          </div>
        </Card>
      )}

      {/* 已完成任务 */}
      {completedTasks.length > 0 && (
        <Card>
          <CardHeader
            title="已完成"
            description="今天已经完成的任务"
          />
          <div className="space-y-3">
            {completedTasks.map((task) => (
              <TaskCard key={task.id} task={task} showFeedback />
            ))}
          </div>
        </Card>
      )}

      {/* 调整说明 */}
      {displayPlan.adjustmentNote && (
        <Card className="bg-amber-50/50">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-amber-800">今日计划调整说明</h3>
              <p className="text-sm text-amber-700 mt-1">{displayPlan.adjustmentNote}</p>
            </div>
          </div>
        </Card>
      )}

      {/* 每日建议 */}
      <Card className="bg-blue-50/50">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-blue-800">今日建议</h3>
            <p className="text-sm text-blue-700 mt-1">
              先完成核心任务，如果状态好再尝试非核心任务。如果今天时间不足，
              至少完成 1 项核心任务，这样不会影响明天计划的合理性。
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
