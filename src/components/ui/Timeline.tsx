import { cn } from "@/lib/utils";
import { ReactNode } from "react";

/**
 * 垂直时间线（v7 原型 .tl / .tl__i / .tl__d）
 *
 * 用于报考流程节点、状态变更历史等按时间顺序排列的事件。
 * - done：已完成节点（ok-bg / ok-ink）
 * - now：当前节点（note-bg / note-ink，圆点带光环）
 * - todo：未到达节点（默认）
 * - 连线只在非末项出现，避免末尾出现空线
 */
export type TimelineStatus = "done" | "now" | "todo";

export interface TimelineItem {
  title: string;
  subtitle?: string;
  meta?: string;
  status?: TimelineStatus;
  content?: ReactNode;
}

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

const dotClass: Record<TimelineStatus, string> = {
  done: "bg-ok-bg border-ok-line text-ok-ink",
  now: "bg-note-bg border-brand text-note-ink ring-4 ring-brand/15",
  todo: "bg-surface border-line text-transparent",
};

export function Timeline({ items, className }: TimelineProps) {
  return (
    <ol className={cn("grid gap-0", className)}>
      {items.map((item, idx) => {
        const status = item.status ?? "todo";
        const isLast = idx === items.length - 1;
        return (
          <li
            key={idx}
            className="grid grid-cols-[22px_minmax(0,1fr)] gap-3.5 pb-4 relative"
          >
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute left-[10px] top-[22px] bottom-0 w-[1.5px] bg-line"
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "z-1 grid place-items-center w-[22px] h-[22px] rounded-full border-2",
                dotClass[status]
              )}
            >
              {status === "done" ? (
                <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none">
                  <path
                    d="M3.5 8.5L6.5 11.5L12.5 4.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-[15px] text-ink">{item.title}</p>
              {item.subtitle && (
                <p className="mt-0.5 text-[13px] text-ink-muted">{item.subtitle}</p>
              )}
              {item.meta && (
                <p className="mt-1 text-[12px] text-ink-muted/80">{item.meta}</p>
              )}
              {item.content && <div className="mt-2">{item.content}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
