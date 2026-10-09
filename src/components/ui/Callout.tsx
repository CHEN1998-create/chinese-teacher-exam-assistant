import { cn } from "@/lib/utils";
import { ReactNode } from "react";

/**
 * 提示块（v7 原型 .callout--ask/no/note/ok/grey）
 *
 * 用于页面内嵌的提示、警示、确认要求或正向反馈。
 * 与 Toast 的区别：Callout 是页面流内联提示，Toast 是浮层全局提示。
 * - ask：需要用户确认 / 警示
 * - no：可能不符合 / 不建议
 * - note：一般信息提示（蓝）
 * - ok：正向反馈 / 已完成
 * - grey：中性说明 / 历史信息
 */
export type CalloutVariant = "ask" | "no" | "note" | "ok" | "grey";

interface CalloutProps {
  variant?: CalloutVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<CalloutVariant, string> = {
  ask: "bg-ask-bg border-ask-line text-ask-ink",
  no: "bg-no-bg border-no-line text-no-ink",
  note: "bg-brand-soft border-brand/40 text-note-ink",
  ok: "bg-ok-bg border-ok-line text-ok-ink",
  grey: "bg-surface-2 border-line text-ink",
};

export function Callout({ variant = "note", title, children, className }: CalloutProps) {
  return (
    <aside
      role="note"
      className={cn(
        "grid gap-2 rounded-md border p-4 text-sm",
        variantStyles[variant],
        className
      )}
    >
      {title && <p className="font-semibold">{title}</p>}
      <div className="leading-relaxed">{children}</div>
    </aside>
  );
}
