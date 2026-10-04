"use client";

import {
  V61_SEED_ANNOUNCEMENTS,
  V61_SEED_FOLLOWS,
} from "@/lib/seed/v61-opportunities";
import { buildStudyView } from "@/lib/ia/study-view";
import { useV61SeedData } from "@/lib/ia/useV61SeedData";
import { Hero } from "@/components/ia/Hero";
import { LayerHeading } from "@/components/ia/Layer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingPage } from "@/components/ui/Loading";

function loadView() {
  return buildStudyView(V61_SEED_FOLLOWS, V61_SEED_ANNOUNCEMENTS);
}

/** 门禁条目：文字 + 符号，不只靠颜色 */
function GateCheck({ passed, text }: { passed: boolean; text: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span
        aria-hidden="true"
        className={
          passed
            ? "mt-0.5 font-bold text-emerald-600"
            : "mt-0.5 font-bold text-slate-400"
        }
      >
        {passed ? "✓" : "○"}
      </span>
      <span className={passed ? "text-slate-700" : "text-slate-500"}>{text}</span>
    </li>
  );
}

function TaskDefinition({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-2">
      <dt className="w-20 shrink-0 text-sm text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm text-slate-800">{value}</dd>
    </div>
  );
}

export default function StudyPage() {
  const { data, loading, error, reload } = useV61SeedData(loadView);

  if (loading) return <LoadingPage />;
  if (error) {
    return <ErrorState title="备考信息暂时加载失败" description={error} onRetry={reload} />;
  }
  if (!data) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-2">
      {data.gate === "no_primary" ? (
        <Hero
          meta="今天先做什么"
          conclusion={data.conclusion}
          risk={{
            tone: "info",
            text: "没有主要目标前不生成备考计划，避免在错误方向上安排时间。",
          }}
          action={{ label: "去选择主要目标", href: "/opportunities" }}
        >
          <ul className="space-y-1.5" aria-label="备考门禁">
            <GateCheck passed={false} text="已从关注的机会中选择一个主要备考目标" />
            <GateCheck passed={false} text="该目标的考试科目与时间已从官方公告核对" />
          </ul>
        </Hero>
      ) : (
        <Hero
          meta="今天只做这一件"
          conclusion={data.conclusion}
          risk={{
            tone: "info",
            text: "今日只安排这一项，任务总时长不会超过你当天可用时间。",
          }}
          action={
            data.todayTask
              ? {
                  label: `打开公告开始核对（约 ${data.todayTask.durationMinutes} 分钟）`,
                  href: data.todayTask.officialUrl,
                  external: true,
                }
              : undefined
          }
        >
          {data.todayTask && (
            <dl className="divide-y divide-slate-100">
              <TaskDefinition label="做什么" value={data.todayTask.title} />
              <TaskDefinition label="用什么" value="官方招聘公告原文（新窗口打开）" />
              <TaskDefinition label="预计多久" value={`约 ${data.todayTask.durationMinutes} 分钟`} />
              <TaskDefinition label="怎样算完成" value={data.todayTask.doneWhen} />
              <TaskDefinition label="为什么先做" value={data.todayTask.whyFirst} />
            </dl>
          )}
        </Hero>
      )}

      {/* 第二层：目标与本周计划（未到门禁时明确为空，不编造任务） */}
      <section className="space-y-3">
        <LayerHeading title="本周计划" />
        {data.target ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{data.target.regionText} · {data.target.stageText}</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{data.target.unitName}</p>
            <p className="mt-1 text-xs text-slate-500">笔试时间：{data.target.writtenExamText}</p>
            <p className="mt-3 text-sm text-slate-500">{data.weekPlanNote}</p>
          </div>
        ) : (
          <EmptyState
            title="本周还没有备考安排"
            description={data.weekPlanNote}
            actionLabel="先选主要目标"
            actionHref="/opportunities"
          />
        )}
      </section>
    </div>
  );
}
