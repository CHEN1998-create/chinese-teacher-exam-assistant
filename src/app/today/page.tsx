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
import { PlanTask, TaskFeedback } from "@/types";
import type { NextStepSummary } from "@/lib/plans/replanEngine";
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

/** 公共资源的可打开链接（用户自有资料无链接） */
function sourceUrlOf(task: PlanTask): string | null {
  if (task.resourceId) {
    const r = resourceService.getById(task.resourceId);
    return r?.sourceUrl ?? null;
  }
  return null;
}

interface NextStepState {
  summary: NextStepSummary;
  version: number;
}

/** 恢复原安排；失败时静默（反馈与历史仍保留） */
function handleRestore(targetId: string, clear: () => void): void {
  try {
    replanService.restoreOriginal(targetId);
    clear();
  } catch {
    // 无可恢复版本等异常：不跳转、不打扰
  }
}

/**
 * 反馈后的“下一步”卡（用户语言）：
 * 只说“下一步做什么、原任务怎么处理”，不出现草稿/版本/信号等内部概念。
 */
function NextStepCard({
  state,
  onRestore,
  onDismiss,
}: {
  state: NextStepState;
  onRestore: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card className="bg-emerald-50/50 border-emerald-200">
      <p className="text-xs font-medium text-emerald-700">已为你调整</p>
      <p className="text-base font-medium text-slate-900 mt-1">{state.summary.nextStep}</p>
      <p className="text-sm text-slate-600 mt-1">{state.summary.originalHandling}</p>
      <div className="flex items-center gap-4 mt-4">
        <button
          type="button"
          onClick={onRestore}
          className="h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-white transition-colors"
        >
          恢复原安排
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          知道了
        </button>
      </div>
    </Card>
  );
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
  const [nextStep, setNextStep] = useState<NextStepState | null>(null);

  const todayPlan = useMemo(
    () => dailyPlans.find((d) => d.date === todayStr) ?? null,
    [dailyPlans, todayStr]
  );

  // 反馈在渲染时直接读取：usePlans 已订阅 feedbackService，提交后自动重渲染
  // 注意：反馈的 dailyPlanId 是提交时所在版本，重排后版本的日计划 id 会变而任务 id 稳定，
  // 因此必须按"今天日期 + 当前计划任务 id"读取，不能只按当前日计划 id（否则改反馈后重登/重排看不到状态）
  const currentTaskIds = useMemo(
    () => new Set(dailyPlans.flatMap((d) => d.tasks.map((t) => t.id))),
    [dailyPlans]
  );
  const feedbacks = feedbackService
    .listByDate(todayStr)
    .filter((f) => currentTaskIds.has(f.taskId));
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
    // 刚反馈“今天没做”导致任务全部顺延：就地展示调整说明，不落入空白态
    if (nextStep) {
      return (
        <div className="space-y-6">
          <ChangeNoticeBanner types={["plan_reconfirm", "exam_change"]} />
          <NextStepCard
            state={nextStep}
            onRestore={() => handleRestore(currentExam.id, () => setNextStep(null))}
            onDismiss={() => setNextStep(null)}
          />
        </div>
      );
    }
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
  // 只有反馈为“做完了”才算今天完成；部分完成的任务已由即时调整生成缩减版
  const pendingTasks = sortedTasks.filter(
    (t) => feedbackByTask.get(t.id)?.status !== "completed"
  );
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
  const currentUrl = sourceUrlOf(currentTask);
  const blocked = currentTask.executable === false;

  /** 反馈提交后：就地调整并展示下一步（不让用户去计划页操作） */
  const handleSubmitted = (status: TaskFeedback["status"]) => {
    if (status === "completed") {
      setNextStep(null);
      return;
    }
    try {
      const adjusted = replanService.applyFeedbackAdjustment(currentExam.id);
      if (adjusted?.summary) {
        setNextStep({ summary: adjusted.summary, version: adjusted.version });
      }
    } catch {
      // 反馈已保存；即时调整失败不阻塞用户继续操作
    }
  };

  /** “明天能学多久”：更新基线，后续任务总时长按它安排 */
  const handleAvailableTimeChange = (minutes: number) => {
    const baseline = materialService.getBaseline(currentExam.id);
    if (!baseline) return;
    materialService.saveBaseline({
      ...baseline,
      dailyAvailableMinutes: minutes,
      weeklyAvailableHours: Math.round((minutes * 7) / 60),
      updatedAt: new Date().toISOString(),
    });
  };

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

        {blocked && (
          <div role="note" className="mt-3 p-3 rounded-lg bg-amber-100/70 text-sm text-amber-800">
            这项任务暂不可执行：{currentTask.blockedReason ?? "资料入口缺失"}
          </div>
        )}

        <dl className="mt-3 space-y-2 text-sm">
          {currentSource && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-slate-400">用什么</dt>
              <dd className="text-slate-700">
                {currentUrl ? (
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-blue-600 hover:underline"
                  >
                    {currentSource}（点击打开）
                  </a>
                ) : (
                  currentSource
                )}
              </dd>
            </div>
          )}
          {!currentSource && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-slate-400">用什么</dt>
              <dd className="text-amber-700">暂无可打开的资料入口</dd>
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

        <details className="mt-3">
          <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
            为什么先做这件事？
          </summary>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            {currentTask.arrangementReason}
          </p>
        </details>

        <div className="mt-5">
          <p className="text-xs text-slate-500 mb-2">做完后来点一下：</p>
          <QuickFeedbackPanel
            key={currentTask.id}
            task={currentTask}
            onSubmitted={handleSubmitted}
            onAvailableTimeChange={handleAvailableTimeChange}
          />
        </div>
      </Card>

      {/* 反馈后就地展示下一步与原任务处理（可恢复原安排） */}
      {nextStep && (
        <NextStepCard
          state={nextStep}
          onRestore={() => handleRestore(currentExam.id, () => setNextStep(null))}
          onDismiss={() => setNextStep(null)}
        />
      )}

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
