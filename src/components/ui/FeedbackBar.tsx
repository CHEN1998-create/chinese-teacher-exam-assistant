import { cn } from "@/lib/utils";

/**
 * 即时反馈条（v7 原型 .fb / .fb__in）
 *
 * 用于 onboarding 每题完成后的轻量、积极、真实反馈。
 * - note（默认）：note-bg / note-ink，进行中提示
 * - done：ok-bg / ok-ink，完成题后的过渡反馈
 *
 * 反馈要求：
 * - 不夸大结果，不承诺录取
 * - 不打断用户继续操作
 * - 自动进入下一题（由调用方控制，组件只负责视觉）
 */
interface FeedbackBarProps {
  message: string;
  variant?: "note" | "done";
  className?: string;
}

export function FeedbackBar({ message, variant = "note", className }: FeedbackBarProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-sm font-semibold",
        variant === "done"
          ? "bg-ok-bg border-ok-line text-ok-ink"
          : "bg-note-bg border-brand/50 text-note-ink",
        className
      )}
    >
      <span aria-hidden="true" className="text-base leading-none">
        {variant === "done" ? "✓" : "·"}
      </span>
      <span className="leading-relaxed">{message}</span>
    </div>
  );
}
