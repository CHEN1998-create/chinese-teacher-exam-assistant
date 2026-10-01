"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TaskCard } from "@/components/ui/TaskCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingPage } from "@/components/ui/Loading";
import { planService, examTargetService } from "@/lib/services";
import { formatDateWithWeekday, formatTime, getWeekdayName } from "@/lib/utils";

export default function PlanPage() {
  const [isLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const currentExam = examTargetService.getCurrent();
  const weeklyPlan = planService.getCurrentPlan();

  const dailyPlans = useMemo(() => {
    if (!weeklyPlan) return [];
    return planService.getDailyPlans(weeklyPlan.id);
  }, [weeklyPlan]);

  const selectedPlan = useMemo(() => {
    if (!selectedDay) return null;
    return dailyPlans.find((d) => d.date === selectedDay);
  }, [selectedDay, dailyPlans]);

  const stats = useMemo(() => {
    let total = 0;
    let completed = 0;
    dailyPlans.forEach((day) => {
      day.tasks.forEach((t) => {
        total++;
        if (t.status === "completed") completed++;
      });
    });
    return { total, completed };
  }, [dailyPlans]);

  if (isLoading) return <LoadingPage />;

  if (!currentExam) {
    return (
      <EmptyState
        title="请先设置考试目标"
        description="在生成计划之前，需要先明确你的考试目标"
        actionLabel="设置目标"
        actionHref="/onboarding"
      />
    );
  }

  if (!weeklyPlan) {
    return (
      <EmptyState
        title="暂无学习计划"
        description="请先完善资料诊断，系统才能为你生成个性化的学习计划"
        actionLabel="去添加资料"
        actionHref="/materials"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 本周概览 */}
      <Card>
        <CardHeader
          title={weeklyPlan.focus}
          description={`${weeklyPlan.startDate} 至 ${weeklyPlan.endDate}`}
        />
        <div className="grid grid-cols-3 gap-4">
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
        </div>
      </Card>

      {/* 七天概览 */}
      <Card>
        <CardHeader title="七天概览" description="点击查看每日详情" />
        <div className="grid grid-cols-7 gap-2">
          {dailyPlans.map((day) => {
            const isToday = day.date === new Date().toISOString().split("T")[0];
            const dayCompleted = day.tasks.filter((t) => t.status === "completed").length;
            const allCompleted = dayCompleted === day.tasks.length && day.tasks.length > 0;
            const isSelected = selectedDay === day.date;

            return (
              <button
                key={day.id}
                onClick={() => setSelectedDay(isSelected ? null : day.date)}
                className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
                  isSelected
                    ? "bg-blue-100 border-2 border-blue-500"
                    : isToday
                    ? "bg-blue-50 border-2 border-blue-300"
                    : allCompleted
                    ? "bg-emerald-50"
                    : "bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <span className="text-xs text-slate-500">{getWeekdayName(day.dayOfWeek)}</span>
                <span
                  className={`text-lg font-bold my-1 ${
                    isSelected
                      ? "text-blue-700"
                      : allCompleted
                      ? "text-emerald-700"
                      : "text-slate-900"
                  }`}
                >
                  {day.date.split("-")[2]}
                </span>
                <div className="flex gap-0.5">
                  {day.tasks.map((t, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${
                        t.status === "completed"
                          ? "bg-emerald-400"
                          : t.status === "partial"
                          ? "bg-amber-400"
                          : "bg-slate-300"
                      }`}
                    />
                  ))}
                </div>
                {day.isMinimumViable && (
                  <span className="text-[10px] text-amber-600 mt-0.5">最低</span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* 今日任务详情 */}
      {selectedPlan && (
        <Card>
          <CardHeader
            title={`${formatDateWithWeekday(selectedPlan.date)}`}
            description={`${selectedPlan.tasks.length} 个任务 · 预计 ${formatTime(
              selectedPlan.totalEstimatedTime
            )}`}
            action={
              <Badge variant={selectedPlan.isMinimumViable ? "warning" : "muted"}>
                {selectedPlan.isMinimumViable ? "最低可完成" : "标准"}
              </Badge>
            }
          />
          {selectedPlan.adjustmentNote && (
            <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg mb-4">
              {selectedPlan.adjustmentNote}
            </p>
          )}
          <div className="space-y-3">
            {selectedPlan.tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </Card>
      )}

      {/* 重排与复盘提示 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-blue-50/50">
          <CardHeader
            title="第4天重排"
            description="根据前3天的执行情况，调整后半周计划"
          />
          <Button variant="outline" size="sm" className="w-full">
            预览重排建议
          </Button>
        </Card>
        <Card className="bg-emerald-50/50">
          <CardHeader
            title="第7天复盘"
            description="回顾本周完成情况，规划下周重点"
          />
          <Button variant="outline" size="sm" className="w-full">
            开始周复盘
          </Button>
        </Card>
      </div>

      {/* 说明 */}
      <Card className="bg-slate-50">
        <CardHeader title="计划说明" description="了解计划的调整逻辑" />
        <div className="space-y-2 text-sm text-slate-600">
          <p>• 每天最多 3 项核心任务，避免任务堆积</p>
          <p>• 时间不足时只保留 1 项最低任务</p>
          <p>• 未完成的任务不会自动堆到第二天</p>
          <p>• 第 4 天会根据前 3 天反馈自动重排</p>
          <p>• 可用时间变化时，任务数量和时长同步调整</p>
        </div>
      </Card>
    </div>
  );
}
