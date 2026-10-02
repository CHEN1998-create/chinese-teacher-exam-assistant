"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  examTargetService,
  feedbackService,
  materialService,
  resourceService,
  replanService,
} from "@/lib/services";
import { usePlans } from "@/lib/plans/usePlans";
import { useTodayString } from "@/lib/plans/useToday";
import { canGeneratePlan } from "@/lib/targets/domain";
import { PlanTask } from "@/types";
import { QuickFeedbackPanel } from "@/components/plans/QuickFeedbackPanel";
import { WeeklyReviewCard } from "@/components/plans/WeeklyReviewCard";
import { ChangeNoticeBanner } from "@/components/governance/ChangeNoticeBanner";
import { formatDateWithWeekday, formatTime, getGreeting } from "@/lib/utils";

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** 任务使用的资料/资源名称（展示用） */
function sourceNameOf(task: PlanTask): string | null {
  if (task.materialId) {
    return materialService.getById(task.materialId)?.name ?? null;
  }
  if (task.resourceId) {
    return resourceService.getById(task.resourceId)?.title ?? null;
  }
  return null;
}

/**
 * 今天（v5.1）：有计划用户的默认首页。
 * 首屏只突出第一项未完成任务；三个快速反馈操作；
 * 反馈成功后自动展示下一项；全部完成后显示完成结果与明天预告；
 * 7 天安排结束后显示本周回顾与下一步。
 */
export default function TodayPage() {
  const currentExam = examTargetService.getCurrent();
  const targetId = currentExam?.id ?? null;
  const { currentPlan, dailyPlans } = usePlans(targetId);
  const todayStr = useTodayString();
  const [onlyFirst, setOnlyFirst] = useState(false);

  const todayPlan = useMemo(
    () => dailyPlans.find((d) => d.date === todayStr) ?? null,
    [dailyPlans, todayStr]
  );

  // 反馈在渲染时直接读取：usePlans 已订阅 feedbackService，提交后自动重渲染
  const feedbacks = todayPlan ? feedbackService.listByDailyPlan(todayPlan.id) : [];
  const feedbackByTask = new Map(feedbacks.map((f) => [f.taskId, f]));

  // ========== 守卫 ==========
  if (!currentExam) {
    return (
      <EmptyState
        title="先说说你想考哪里"
        description="回答三个问题，就能看到今天最该做的一件事"
        actionLabel="开始快速问答"
        actionHref="/onboarding"
      />
    );
  }

  if (!canGeneratePlan(currentExam)) {
    return (
      <EmptyState
        icon={<span className="text-5xl">🧭</span>}
        title="先确认这次考试的基本信息"
        description="信息确认前不会安排每日任务，避免按错误的考情准备。"
        actionLabel="去确认"
        actionHref="/exam"
      />
    );
  }

  if (!currentPlan || currentPlan.status !== "active") {
    return (
      <EmptyState
        icon={<span className="text-5xl">📋</span>}
        title={currentPlan ? "安排还没有确认" : "还没有接下来 7 天的安排"}
        description={
          currentPlan
            ? "你有一份草稿，确认后今天就能按它执行。"
            : "生成并确认后，每天打开这里就知道先做什么。"
        }
        actionLabel="去看看接下来 7 天"
        actionHref="/plan"
      />
    );
  }

  // ========== 7 天安排已结束：本周回顾 + 下一步 ==========
  if (todayStr > currentPlan.endDate) {
    const review = replanService.getLatestReview(currentExam.id);
    return (
      <div className="space-y-6">
        <ChangeNoticeBanner types={["plan_reconfirm", "exam_change"]} />
        <div>
          <h2 className="text-xl font-bold text-slate-900">这 7 天的安排结束了</h2>
          <p className="text-sm text-slate-500 mt-1">
            {formatDateWithWeekday(currentPlan.startDate)} — {formatDateWithWeekday(currentPlan.endDate)}
          </p>
        </div>
        {review ? (
          <WeeklyReviewCard review={review} />
        ) : (
          <Card>
            <p className="text-sm text-slate-600">
              本周回顾还没有生成，可以在「接下来 7 天」里生成回顾，看看这一周完成得怎么样。
            </p>
          </Card>
        )}
        <Link
          href="/plan"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          安排下一周
        </Link>
      </div>
    );
  }

  // ========== 今天没有任务 ==========
  if (!todayPlan || todayPlan.tasks.length === 0) {
    return (
      <EmptyState
        icon={<span className="text-5xl">🌤️</span>}
        title="今天没有安排任务"
        description={`当前安排从 ${currentPlan.startDate} 开始，今天可以休息或自由复习。`}
        actionLabel="查看接下来 7 天"
        actionHref="/plan"
      />
    );
  }

  const sortedTasks = [...todayPlan.tasks].sort((a, b) => a.order - b.order);
  const pendingTasks = sortedTasks.filter((t) => !feedbackByTask.has(t.id));
  const doneCount = sortedTasks.length - pendingTasks.length;
  const totalActual = feedbacks.reduce((sum, f) => sum + (f.actualTime ?? 0), 0);

  // ========== 全部完成：完成结果 + 明天预告 ==========
  if (pendingTasks.length === 0) {
    const tomorrowStr = addDays(todayStr, 1);
    const tomorrowPlan = dailyPlans.find((d) => d.date === tomorrowStr) ?? null;
    const isLastDay = todayStr === currentPlan.endDate;
    return (
      <div className="space-y-6">
        <ChangeNoticeBanner types={["plan_reconfirm", "exam_change"]} />
        <Card className="text-center py-8">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🎉</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">今天的任务都完成了</h2>
          <p className="text-sm text-slate-500 mt-2">
            共 {sortedTasks.length} 项
            {totalActual > 0 && ` · 实际用时约 ${formatTime(totalActual)}`}
          </p>
        </Card>

        {!isLastDay && tomorrowPlan && tomorrowPlan.tasks.length > 0 && (
          <Card>
            <p className="text-sm font-medium text-slate-900 mb-3">
              明天预告（{formatDateWithWeekday(tomorrowStr)}）
            </p>
            <ul className="space-y-2">
              {[...tomorrowPlan.tasks]
                .sort((a, b) => a.order - b.order)
                .map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-700 truncate">{t.title}</span>
                    <span className="text-xs text-slate-400 shrink-0">
                      约 {formatTime(t.estimatedTime)}
                    </span>
                  </li>
                ))}
            </ul>
          </Card>
        )}

        {isLastDay && (
          <Card>
            <p className="text-sm text-slate-600">
              这是本次安排的最后一天。明天起可以查看本周回顾，并安排下一周。
            </p>
          </Card>
        )}

        <Link
          href="/plan"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          查看接下来 7 天
        </Link>
      </div>
    );
  }

  // ========== 正常执行：突出第一项任务 ==========
  const visiblePending = onlyFirst ? pendingTasks.slice(0, 1) : pendingTasks;
  const currentTask = visiblePending[0];
  const currentSource = sourceNameOf(currentTask);

  return (
    <div className="space-y-6">
      {/* 重要考试信息变化优先提示 */}
      <ChangeNoticeBanner types={["plan_reconfirm", "exam_change"]} />

      <div>
        <h2 className="text-xl font-bold text-slate-900">
          {getGreeting()}，今天先做这一项
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {formatDateWithWeekday(todayStr)} · 已完成 {doneCount}/{sortedTasks.length} 项
          {totalActual > 0 && ` · 已用时 ${formatTime(totalActual)}`}
        </p>
      </div>

      {/* 当前任务：做什么 / 用什么 / 多久 / 怎样算完成 */}
      <Card className="border-blue-200 bg-blue-50/40">
        {todayPlan.isMinimumViable && (
          <Badge variant="warning">今天时间少，先完成这一项就好</Badge>
        )}
        <h3 className="text-lg font-bold text-slate-900 mt-2">{currentTask.title}</h3>
        <dl className="mt-3 space-y-2 text-sm">
          {currentSource && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-slate-400">用什么</dt>
              <dd className="text-slate-700">{currentSource}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="shrink-0 text-slate-400">需要多久</dt>
            <dd className="text-slate-700">约 {formatTime(currentTask.estimatedTime)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-slate-400">怎样算完成</dt>
            <dd className="text-slate-700">{currentTask.completionCriteria}</dd>
          </div>
        </dl>

        <div className="mt-5">
          <p className="text-xs text-slate-500 mb-2">做完后来点一下：</p>
          <QuickFeedbackPanel
            key={currentTask.id}
            task={currentTask}
            onSubmitted={() => {
              /* usePlans 订阅自动刷新，下一项任务自动出现 */
            }}
          />
        </div>
      </Card>

      {/* 时间不够时的简化安排 */}
      {pendingTasks.length > 1 && !onlyFirst && (
        <button
          type="button"
          onClick={() => setOnlyFirst(true)}
          className="text-sm text-slate-500 hover:text-blue-600 transition-colors"
        >
          今天时间不够？只看最关键的一项 →
        </button>
      )}
      {onlyFirst && (
        <button
          type="button"
          onClick={() => setOnlyFirst(false)}
          className="text-sm text-slate-500 hover:text-blue-600 transition-colors"
        >
          时间够了？查看今天全部 {pendingTasks.length} 项待办 →
        </button>
      )}

      {/* 其余待办（简化列表） */}
      {visiblePending.length > 1 && (
        <Card>
          <p className="text-sm font-medium text-slate-900 mb-3">接下来的任务</p>
          <ul className="space-y-2">
            {visiblePending.slice(1).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-700 truncate">{t.title}</span>
                <span className="text-xs text-slate-400 shrink-0">
                  约 {formatTime(t.estimatedTime)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400 mt-3">
            完成当前这项后会自动切换；未完成的任务不会全部堆到明天。
          </p>
        </Card>
      )}

      {todayPlan.adjustmentNote && (
        <Card className="bg-amber-50/50">
          <p className="text-sm text-amber-800">
            <span className="font-medium">安排有调整：</span>
            {todayPlan.adjustmentNote}
          </p>
        </Card>
      )}
    </div>
  );
}
