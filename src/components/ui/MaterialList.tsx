"use client";

import { cn } from "@/lib/utils";

/**
 * 材料清单（v7 原型 .task 复选样式 + .metric 完成度）
 *
 * 每项材料可点击切换 in_use / partial_use / paused 等状态。
 * - 不引入新的状态系统，状态语义沿用领域模型 MaterialStatus
 * - 点击只触发 onToggle，由调用方写入后端，组件不持有业务状态
 * - 危险操作（删除/替换）不在本组件处理，由调用方提供 ConfirmModal
 */
export type MaterialListItemStatus = "todo" | "done" | "partial" | "paused";

export interface MaterialListItem {
  id: string;
  name: string;
  status: MaterialListItemStatus;
  required?: boolean;
  note?: string;
}

interface MaterialListProps {
  items: MaterialListItem[];
  onToggle?: (id: string) => void;
  /** 完成度统计；若不传则不显示进度条 */
  summary?: { done: number; total: number };
  className?: string;
}

const statusMeta: Record<
  MaterialListItemStatus,
  { label: string; pressed: boolean; tag?: string }
> = {
  todo: { label: "待准备", pressed: false },
  done: { label: "已备齐", pressed: true, tag: "bg-ok-bg text-ok-ink border-ok-line" },
  partial: {
    label: "部分",
    pressed: false,
    tag: "bg-warn-soft text-warn border-warn/30",
  },
  paused: {
    label: "暂缓",
    pressed: false,
    tag: "bg-grey-bg text-ink-muted border-line",
  },
};

export function MaterialList({ items, onToggle, summary, className }: MaterialListProps) {
  return (
    <section className={cn("grid gap-3", className)}>
      {summary && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-ink-muted">材料完成度</span>
          <div className="flex items-center gap-2 flex-1">
            <div className="flex-1 h-1.5 rounded-pill bg-grey-bg overflow-hidden">
              <div
                className="h-full bg-ok-ink transition-all"
                style={{
                  width: `${summary.total === 0 ? 0 : Math.min(100, (summary.done / summary.total) * 100)}%`,
                }}
              />
            </div>
            <span className="text-xs text-ink-muted">
              {summary.done}/{summary.total}
            </span>
          </div>
        </div>
      )}
      <ul className="grid gap-2">
        {items.map((item) => {
          const meta = statusMeta[item.status];
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={meta.pressed}
                onClick={() => onToggle?.(item.id)}
                className={cn(
                  "flex items-start gap-3 w-full p-3.5 border rounded-md text-left transition-colors",
                  meta.pressed
                    ? "bg-ok-bg border-ok-line"
                    : "bg-surface border-line hover:border-brand/40 hover:bg-brand-soft/30"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid place-items-center flex-none w-6 h-6 border-[1.5px] rounded-xs mt-0.5",
                    meta.pressed
                      ? "bg-ok-ink border-ok-ink text-on-dark"
                      : "bg-surface border-ink-muted/50 text-transparent"
                  )}
                >
                  {meta.pressed && (
                    <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none">
                      <path
                        d="M3.5 8.5L6.5 11.5L12.5 4.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink break-words">{item.name}</p>
                    {item.required && (
                      <span className="text-[11px] text-danger">必需</span>
                    )}
                    {item.status !== "todo" && meta.tag && (
                      <span
                        className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded-full border text-[11px]",
                          meta.tag
                        )}
                      >
                        {meta.label}
                      </span>
                    )}
                  </div>
                  {item.note && (
                    <p className="mt-0.5 text-xs text-ink-muted break-words">{item.note}</p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
