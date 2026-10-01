"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TaskCard } from "@/components/ui/TaskCard";
import { FeedbackForm } from "@/components/ui/FeedbackForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingPage } from "@/components/ui/Loading";
import { planService, examTargetService } from "@/lib/services";
import { usePlans } from "@/lib/plans/usePlans";
import { canGeneratePlan } from "@/lib/targets/domain";
import { TaskFeedback } from "@/types";
import { formatDateWithWeekday, formatTime, getGreeting } from "@/lib/utils";

export default function TodayPage() {
  const [isLoading] = useState(false);
  const [feedbackTaskId, setFeedbackTaskId] = useState<string | null>(null);
  const [showFeedbackSuccess, setShowFeedbackSuccess] = useState(false);

  const currentExam = examTargetService.getCurrent();
  const targetId = currentExam?.id ?? null;
  const { currentPlan, dailyPlans } = usePlans(targetId);

  const todayStr = new Date().toISOString().split("T")[0];
  const todayPlan = useMemo(
    () => dailyPlans.find((d) => d.date === todayStr) ?? null,
    [dailyPlans, todayStr]
  );

  const coreTasks = useMemo(
    () => todayPlan?.tasks.filter((t) => t.isCore) ?? [],
    [todayPlan]
  );

  const pendingTasks = useMemo(
    () =>
      todayPlan?.tasks.filter(
        (t) => t.status === "pending" || t.status === "in_progress"
      ) ?? [],
    [todayPlan]
  );

  const completedTasks = useMemo(
    () =>
      todayPlan?.tasks.filter(
        (t) => t.status === "completed" || t.status === "partial"
      ) ?? [],
    [todayPlan]
  );

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

  // 没有已确认的计划
  if (!currentPlan || currentPlan.status !== "active") {
    return (
      <EmptyState
        icon={<span className="text-5xl">📋</span>}
        title={currentPlan ? "计划尚未确认" : "还没有学习计划"}
        description={
          currentPlan
            ? "你有一份草稿计划，请先在「本周计划」页确认后，今日任务才会显示。"
            : "请先在「本周计划」页生成并确认计划，系统会自动安排今日任务。"
        }
        actionLabel="去生成本周计划"
        actionHref="/plan"
      />
    );
  }

  // 今天不在计划周期内
  if (!todayPlan) {
    return (
      <EmptyState
        title="今日暂无任务"
        description={`当前计划周期为 ${currentPlan.startDate} 至 ${currentPlan.endDate}，今天不在计划范围内。`}
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
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          {getGreeting()}，今天有 {pendingTasks.length} 项任务待完成
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {todayPlan ? formatDateWithWeekday(todayPlan.date) : ""} · 预计用时{" "}
          {formatTime(todayPlan.totalEstimatedTime)} / 可用{" "}
          {formatTime(todayPlan.availableMinutes)}
        </p>
      </div>

      {showFeedbackSuccess && (
        <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-sm font-medium">
          反馈已提交
        </div>
      )}

      {todayPlan.isMinimumViable && (
        <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-sm">
          今天可用时间较少，只安排了最低可完成任务，优先完成它即可。
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
              <TaskCard task={task} showPlanMeta />
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
          {coreTasks.length === 0 && (
            <p className="text-sm text-slate-500">今天没有核心任务。</p>
          )}
        </div>
      </Card>

      {/* 非核心任务 */}
      {todayPlan.tasks.some((t) => !t.isCore) && (
        <Card>
          <CardHeader
            title="补充任务"
            description="有时间可以尝试，不影响核心进度"
          />
          <div className="space-y-3">
            {todayPlan.tasks
              .filter((t) => !t.isCore)
              .map((task) => (
                <TaskCard key={task.id} task={task} compact showPlanMeta />
              ))}
          </div>
        </Card>
      )}

      {/* 已完成任务 */}
      {completedTasks.length > 0 && (
        <Card>
          <CardHeader title="已完成" description="今天已经完成的任务" />
          <div className="space-y-3">
            {completedTasks.map((task) => (
              <TaskCard key={task.id} task={task} showFeedback />
            ))}
          </div>
        </Card>
      )}

      {/* 调整说明 */}
      {todayPlan.adjustmentNote && (
        <Card className="bg-amber-50/50">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-amber-800">今日计划调整说明</h3>
              <p className="text-sm text-amber-700 mt-1">{todayPlan.adjustmentNote}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
