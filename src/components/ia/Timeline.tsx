import { cn } from "@/lib/utils";
import type { ScheduleEvent, ScheduleGroup, ScheduleUrgency } from "@/lib/ia/schedule-view";

/**
 * 日程时间线（IA 第 5 节）：按关注机会分组的纵向时间线，不默认展示月历。
 * 时间未定显示“待官方通知”；过去节点弱化；强度用文字标签表达，不只靠颜色。
 */

const URGENCY_META: Record<ScheduleUrgency, { text: string; className: string }> = {
  must: { text: "必须处理", className: "border-red-200 bg-red-50 text-red-700" },
  suggest: { text: "建议处理", className: "border-amber-200 bg-amber-50 text-amber-700" },
  info: { text: "普通信息", className: "border-slate-200 bg-slate-50 text-slate-500" },
};

function EventRow({ event, isLast }: { event: ScheduleEvent; isLast: boolean }) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {/* 竖向连接线 */}
      {!isLast && (
        <span aria-hidden="true" className="absolute left-[5px] top-4 h-full w-px bg-slate-200" />
      )}
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2",
          event.past
            ? "border-slate-300 bg-slate-100"
            : event.urgency === "must"
              ? "border-red-500 bg-white"
              : event.urgency === "suggest"
                ? "border-amber-500 bg-white"
                : "border-slate-400 bg-white",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className={cn("text-sm font-medium", event.past ? "text-slate-400" : "text-slate-900")}>
            {event.kindLabel}
          </p>
          {!event.past && !event.pending && (
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                URGENCY_META[event.urgency].className,
              )}
            >
              {URGENCY_META[event.urgency].text}
            </span>
          )}
          {event.past && (
            <span className="text-[11px] text-slate-400">已过去</span>
          )}
        </div>
        <p className={cn("mt-0.5 text-sm", event.past ? "text-slate-400" : "text-slate-600")}>
          {event.dateText}
        </p>
        {event.action && (
          <div className="mt-1.5">
            {event.action.external ? (
              <a
                href={event.action.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center rounded-lg border border-blue-200 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                {event.action.label}
              </a>
            ) : (
              <a
                href={event.action.href}
                className="inline-flex h-9 items-center rounded-lg border border-blue-200 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                {event.action.label}
              </a>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function TimelineGroup({ group }: { group: ScheduleGroup }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{group.regionText}</p>
      <h3 className="mt-0.5 text-sm font-semibold text-slate-900">{group.title}</h3>
      <ol className="mt-3">
        {group.events.map((event, index) => (
          <EventRow
            key={event.id}
            event={event}
            isLast={index === group.events.length - 1}
          />
        ))}
      </ol>
    </section>
  );
}

export function Timeline({ groups }: { groups: ScheduleGroup[] }) {
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <TimelineGroup key={group.unitId} group={group} />
      ))}
    </div>
  );
}
