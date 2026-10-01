"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { examTargetService, feedbackService, nextStepHint } from "@/lib/services";
import { usePlans } from "@/lib/plans/usePlans";
import { useTodayString } from "@/lib/plans/useToday";
import { canGeneratePlan } from "@/lib/targets/domain";
import { CompletionStatus } from "@/types";
import { TodayTaskItem } from "@/components/plans/TodayTaskItem";
import { ChangeNoticeBanner } from "@/components/governance/ChangeNoticeBanner";
import { formatDateWithWeekday, formatTime, getGreeting } from "@/lib/utils";

export default function TodayPage() {
  const currentExam = examTargetService.getCurrent();
  const targetId = currentExam?.id ?? null;
  const { currentPlan, dailyPlans } = usePlans(targetId);
  const todayStr = useTodayString();

  const [hint, setHint] = useState<{ status: CompletionStatus; nonce: number } | null>(null);

  const todayPlan = useMemo(
    () => dailyPlans.find((d) => d.date === todayStr) ?? null,
    [dailyPlans, todayStr]
  );

  // 反馈在渲染时直接读取：usePlans 已订阅 feedbackService，提交/修改会触发重渲染
  const feedbacks = todayPlan ? feedbackService.listByDailyPlan(todayPlan.id) : [];

  const feedbackByTask = new Map(feedbacks.map((f) => [f.taskId, f]));

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

  // 计划未确认（没有计划或只有草稿）
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

  // 今天没有任务（不在计划周期内，或当日未排任务）
  if (!todayPlan || todayPlan.tasks.length === 0) {
    return (
      <EmptyState
        icon={<span className="text-5xl">🌤️</span>}
        title="今日暂无任务"
        description={`当前执行中计划周期为 ${currentPlan.startDate} 至 ${currentPlan.endDate}，今天没有安排任务。`}
        actionLabel="查看本周计划"
        actionHref="/plan"
      />
    );
  }

  const sortedTasks = [...todayPlan.tasks].sort((a, b) => a.order - b.order);
  const coreTasks = sortedTasks.filter((t) => t.isCore);
  const extraTasks = sortedTasks.filter((t) => !t.isCore);
  const pendingCount = sortedTasks.filter((t) => !feedbackByTask.has(t.id)).length;
  const totalActual = feedbacks.reduce((sum, f) => sum + (f.actualTime ?? 0), 0);

  return (
    <div className="space-y-6">
      <ChangeNoticeBanner types={["plan_reconfirm", "exam_change"]} />
      {/* 概览 */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          {getGreeting()}，今天有 {pendingCount} 项任务待反馈
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {formatDateWithWeekday(todayPlan.date)} · 计划用时{" "}
          {formatTime(todayPlan.totalEstimatedTime)} / 可用{" "}
          {formatTime(todayPlan.availableMinutes)}
          {totalActual > 0 && ` · 已记录实际用时 ${formatTime(totalActual)}`}
        </p>
      </div>

      {/* 提交后的下一步提示（正式重排由下一模块负责） */}
      {hint && (
        <div
          key={hint.nonce}
          className="p-3.5 bg-emerald-50 text-emerald-800 rounded-xl text-sm font-medium flex items-start gap-2"
        >
          <span className="shrink-0">✅</span>
          <span>{nextStepHint(hint.status)}</span>
        </div>
      )}

      {todayPlan.isMinimumViable && (
        <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-sm">
          今天可用时间较少，只安排了最低可完成任务，优先完成它即可。
        </div>
      )}

      {/* 今日核心任务（1—3 项） */}
      <Card>
        <CardHeader
          title="今日核心任务"
          description="这些是今天最重要的学习任务，完成后请花一分钟提交反馈"
          action={
            pendingCount > 0 ? (
              <Badge variant="primary">{pendingCount} 项待反馈</Badge>
            ) : (
              <Badge variant="success">今日已全部反馈</Badge>
            )
          }
        />
        <div className="space-y-4">
          {coreTasks.map((task, idx) => (
            <TodayTaskItem
              key={task.id}
              task={task}
              feedback={feedbackByTask.get(task.id) ?? null}
              isMinimumViableTask={todayPlan.isMinimumViable && idx === 0}
              onSubmitted={(status) => setHint({ status, nonce: Date.now() })}
            />
          ))}
          {coreTasks.length === 0 && (
            <p className="text-sm text-slate-500">今天没有核心任务。</p>
          )}
        </div>
      </Card>

      {/* 补充任务 */}
      {extraTasks.length > 0 && (
        <Card>
          <CardHeader
            title="补充任务"
            description="有时间可以尝试，不影响核心进度；完成后同样可以提交反馈"
          />
          <div className="space-y-4">
            {extraTasks.map((task) => (
              <TodayTaskItem
                key={task.id}
                task={task}
                feedback={feedbackByTask.get(task.id) ?? null}
                onSubmitted={(status) => setHint({ status, nonce: Date.now() })}
              />
            ))}
          </div>
        </Card>
      )}

      {/* 调整说明 */}
      {todayPlan.adjustmentNote && (
        <Card className="bg-amber-50/50">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
              <svg
                className="w-4 h-4 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
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
