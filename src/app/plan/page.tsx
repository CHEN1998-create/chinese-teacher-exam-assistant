"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingPage } from "@/components/ui/Loading";
import { DailyPlanCard } from "@/components/plans/DailyPlanCard";
import { ReplanPanel } from "@/components/plans/ReplanPanel";
import { WeeklyReviewCard } from "@/components/plans/WeeklyReviewCard";
import { ChangeNoticeBanner } from "@/components/governance/ChangeNoticeBanner";
import { planService, replanService, examTargetService } from "@/lib/services";
import { usePlans } from "@/lib/plans/usePlans";
import { todayString } from "@/lib/plans/useToday";
import { canGeneratePlan } from "@/lib/targets/domain";
import { formatDateWithWeekday, formatTime } from "@/lib/utils";
import { PLAN_STATUS_LABELS, WeeklyReview } from "@/types";

export default function PlanPage() {
  const router = useRouter();
  const [isLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);

  const currentExam = examTargetService.getCurrent();
  const targetId = currentExam?.id ?? null;
  const { currentPlan, dailyPlans, versions } = usePlans(targetId);
  const [todayStr] = useState<string>(() => todayString());
  // 执行中版本：重排面板以它为基准（currentPlan 可能是待确认的草稿）
  const activePlan = versions.find((v) => v.status === "active") ?? null;

  const readiness = targetId ? planService.getReadiness(targetId) : null;

  const stats = useMemo(() => {
    let total = 0;
    let completed = 0;
    let totalMinutes = 0;
    dailyPlans.forEach((day) => {
      day.tasks.forEach((t) => {
        total++;
        totalMinutes += t.estimatedTime;
        if (t.status === "completed") completed++;
      });
    });
    return { total, completed, totalMinutes };
  }, [dailyPlans]);

  if (isLoading) return <LoadingPage />;

  if (!currentExam) {
    return (
      <EmptyState
        title="请先设置考试目标"
        description="在生成计划之前，需要先明确你的考试目标"
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
        description={`当前目标「${currentExam.name}」信息还不充分，目标明确前不会生成精确计划。`}
        actionLabel="去完成目标澄清"
        actionHref="/exam"
      />
    );
  }

  const handleGenerate = () => {
    setError(null);
    try {
      planService.generateDraft(targetId!);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败，请稍后重试");
    }
  };

  const handleConfirm = () => {
    if (!currentPlan) return;
    planService.confirmPlan(currentPlan.id);
  };

  const handleRegenerate = () => {
    setError(null);
    try {
      planService.regenerate(targetId!);
    } catch (e) {
      setError(e instanceof Error ? e.message : "重新生成失败");
    }
  };

  const handleAdjustTime = (dailyPlanId: string, minutes: number) => {
    planService.adjustDailyTime(dailyPlanId, minutes);
  };

  // 数据不足：展示缺失项，不生成计划
  if (!currentPlan && readiness && !readiness.ready) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader
            title="还不能生成学习计划"
            description="以下信息缺失时不会生成假精确的计划，请先补全"
          />
          <ul className="space-y-2 mt-2">
            {readiness.missing.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="text-red-500 mt-0.5">●</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 mt-4">
            <Button variant="primary" onClick={() => router.push("/materials")}>
              去补全资料
            </Button>
            <Button variant="outline" onClick={() => router.push("/exam")}>
              去补全考情
            </Button>
          </div>
        </Card>
        {readiness.warnings.length > 0 && (
          <Card className="bg-amber-50/50">
            <CardHeader title="温馨提示" description="即使生成计划，以下信息也会影响准确性" />
            <ul className="space-y-1 text-sm text-amber-800">
              {readiness.warnings.map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    );
  }

  // 没有计划但数据就绪：展示生成入口
  if (!currentPlan) {
    return (
      <div className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}
        <Card>
          <CardHeader
            title="生成 7 天学习计划"
            description={`目标：${currentExam.name}`}
          />
          <p className="text-sm text-slate-600 mt-2">
            系统将根据你的目标、已审核考情、资料诊断、已加入计划的资源和可用时间，
            自动生成一份可执行的 7 天计划。生成后为草稿状态，确认后开始执行。
          </p>
          {readiness?.warnings && readiness.warnings.length > 0 && (
            <div className="mt-3 p-3 bg-amber-50 rounded-lg text-sm text-amber-800">
              {readiness.warnings.map((w, i) => (
                <p key={i}>• {w}</p>
              ))}
            </div>
          )}
          <Button className="mt-4" onClick={handleGenerate}>
            生成草稿计划
          </Button>
        </Card>
      </div>
    );
  }

  // 已有计划：展示概览 + 每日任务
  return (
    <div className="space-y-6">
      <ChangeNoticeBanner types={["exam_change", "plan_reconfirm"]} />
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* 本周概览 */}
      <Card>
        <CardHeader
          title={currentPlan.focus}
          description={`${currentPlan.startDate} 至 ${currentPlan.endDate}`}
          action={
            <Badge
              variant={
                currentPlan.status === "active"
                  ? "success"
                  : currentPlan.status === "draft"
                    ? "warning"
                    : "muted"
              }
            >
              {PLAN_STATUS_LABELS[currentPlan.status]} · v{currentPlan.version}
            </Badge>
          }
        />
        <p className="text-sm text-slate-500 mt-1">{currentPlan.generationReason}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="p-3 bg-blue-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-700">{dailyPlans.length}</p>
            <p className="text-xs text-blue-600">计划天数</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-emerald-700">{stats.completed}</p>
            <p className="text-xs text-emerald-600">已完成任务</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-slate-700">
              {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
            </p>
            <p className="text-xs text-slate-600">完成率</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-purple-700">{formatTime(stats.totalMinutes)}</p>
            <p className="text-xs text-purple-600">总预计时长</p>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-wrap gap-2 mt-4">
          {currentPlan.status === "draft" && (
            <Button variant="primary" onClick={handleConfirm}>
              确认计划，开始执行
            </Button>
          )}
          <Button variant="outline" onClick={handleRegenerate}>
            重新生成草稿
          </Button>
          <Button variant="ghost" onClick={() => setShowVersions(!showVersions)}>
            {showVersions ? "收起版本历史" : "查看版本历史"}
          </Button>
        </div>

        {currentPlan.status === "draft" && (
          <p className="text-xs text-amber-600 mt-2">
            当前为草稿状态，确认后计划将进入执行状态，今日任务模块可读取。
          </p>
        )}
      </Card>

      {/* 动态重排（存在执行中版本即可见；重排草稿基于执行中版本生成） */}
      {activePlan && targetId && (
        <ReplanPanel targetId={targetId} activePlan={activePlan} />
      )}

      {/* 版本历史 */}
      {showVersions && versions.length > 0 && (
        <Card>
          <CardHeader title="计划版本历史" description={`共 ${versions.length} 个版本`} />
          <div className="space-y-2">
            {versions.map((v) => (
              <div
                key={v.id}
                className={`flex items-center justify-between p-2 rounded-lg ${
                  v.id === currentPlan.id ? "bg-blue-50" : "hover:bg-slate-50"
                }`}
              >
                <div>
                  <span className="font-medium text-sm">v{v.version}</span>
                  <span className="text-sm text-slate-500 ml-2">{v.focus}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="muted">{PLAN_STATUS_LABELS[v.status]}</Badge>
                  <span className="text-xs text-slate-400">
                    {formatDateWithWeekday(v.startDate)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 七天概览 */}
      <Card>
        <CardHeader title="七天任务概览" description="点击展开查看每日任务详情、安排原因与复盘动作" />
        <div className="space-y-3 mt-2">
          {dailyPlans.map((day) => (
            <DailyPlanCard key={day.id} plan={day} onAdjustTime={handleAdjustTime} />
          ))}
        </div>
      </Card>

      {/* 第 7 天周复盘 */}
      {targetId && (todayStr >= currentPlan.endDate || currentPlan.status === "completed") && (
        <WeeklyReviewSection key={currentPlan.id} targetId={targetId} />
      )}

      {/* 说明 */}
      <Card className="bg-slate-50">
        <CardHeader title="计划规则说明" />
        <div className="space-y-1.5 text-sm text-slate-600">
          <p>• 每天最多 3 项核心任务，避免任务堆积</p>
          <p>• 每天任务总时长不超过当天可用时间</p>
          <p>• 每天至少保留 1 项最低可完成任务</p>
          <p>• 关键考试模块与薄弱模块优先安排</p>
          <p>• 未通过适用性判断的资料不会作为主要任务来源</p>
          <p>• 执行反馈会驱动重排建议：重排草稿确认后生成新版本，历史版本保留可对比</p>
          <p>• 未完成欠账不会全部堆到第二天，系统在保留/缩减/顺延/替换/放弃之间分配</p>
        </div>
      </Card>
    </div>
  );
}

/** 第 7 天周复盘区块：计划结束后可生成（数据仅来自真实反馈）。父组件以 key={planId} 控制重挂载 */
function WeeklyReviewSection({ targetId }: { targetId: string }) {
  const [review, setReview] = useState<WeeklyReview | null>(() =>
    replanService.getLatestReview(targetId)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = (): void => {
    setBusy(true);
    setError(null);
    try {
      setReview(replanService.generateReview(targetId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成周复盘失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="第 7 天周复盘"
        description="完成情况、时间使用、中断原因、错因与下周建议（仅统计真实提交的反馈）"
        action={
          <Button variant={review ? "outline" : "primary"} size="sm" onClick={handleGenerate} disabled={busy}>
            {busy ? "生成中…" : review ? "重新生成复盘" : "生成周复盘"}
          </Button>
        }
      />
      {error && <div className="p-2.5 bg-rose-50 text-rose-700 rounded-lg text-sm">{error}</div>}
      {review && <WeeklyReviewCard review={review} />}
    </Card>
  );
}
