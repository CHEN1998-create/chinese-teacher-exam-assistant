"use client";

import {
  V61_NOW,
  V61_SEED_ANNOUNCEMENTS,
  V61_SEED_FOLLOWS,
} from "@/lib/seed/v61-opportunities";
import { buildScheduleView } from "@/lib/ia/schedule-view";
import { useV61SeedData } from "@/lib/ia/useV61SeedData";
import { Hero } from "@/components/ia/Hero";
import { Timeline } from "@/components/ia/Timeline";
import { LayerHeading } from "@/components/ia/Layer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingPage } from "@/components/ui/Loading";

function loadView() {
  return buildScheduleView(V61_SEED_FOLLOWS, V61_SEED_ANNOUNCEMENTS, V61_NOW);
}

export default function SchedulePage() {
  const { data, loading, error, reload } = useV61SeedData(loadView);

  if (loading) return <LoadingPage />;
  if (error) {
    return <ErrorState title="日程暂时加载失败" description={error} onRetry={reload} />;
  }
  if (!data) return null;

  // 空态 1：没有关注任何机会——不制造虚假紧迫感
  if (!data.next && data.groups.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          title="还没有不能错过的事"
          description="关注机会后，报名开始/截止、笔试等官方节点才会出现在这里。未关注的机会不会凭空产生提醒。"
          actionLabel="去看看机会"
          actionHref="/opportunities"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-2">
      {data.next ? (
        <Hero
          meta="下一件不能错过的事"
          conclusion={`${data.next.groupTitle} · ${data.next.event.kindLabel}`}
          risk={{
            tone: data.next.event.urgency === "must" ? "must" : "info",
            text:
              data.next.event.urgency === "must"
                ? `必须处理：${data.next.event.dateText}，截止后通常无法补报名，请提前准备材料`
                : `建议处理：${data.next.event.dateText}，提前安排当天时间`,
          }}
          action={
            data.next.event.action
              ? {
                  label: data.next.event.action.label,
                  href: data.next.event.action.href,
                  external: data.next.event.action.external,
                }
              : undefined
          }
        >
          <p className="text-sm text-slate-600">
            {data.next.regionText} · {data.next.event.dateText}
          </p>
        </Hero>
      ) : (
        // 空态 2：有关注但近期没有需要行动的节点（时间未定显示“待官方通知”）
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-lg font-semibold text-slate-900">近期没有需要处理的节点</p>
          <p className="mt-2 text-sm text-slate-500">
            时间未定的事项一律显示“待官方通知”，不会用推测日期提醒你。下面可以查看已关注机会的完整时间线。
          </p>
        </div>
      )}

      {/* 第二层：按关注机会分组的时间线；不默认展示月历 */}
      <section className="space-y-3">
        <LayerHeading title="关注机会时间线" count={data.groups.length} />
        <Timeline groups={data.groups} />
      </section>
    </div>
  );
}
