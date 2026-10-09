"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * Toast / SnackBar（v7 原型 .toasts / .toast）
 *
 * - 视觉：固定底部居中，bg-ink + text-on-dark + shadow-3 + rounded-md
 * - 由调用方控制显示与关闭（不引入全局 Provider，避免改动 AppShell）
 * - 每条 Toast 默认 3.2s 自动关闭，可传 duration={0} 保持常驻
 * - 危险或不可逆操作的反馈必须显示足够长时间或要求手动关闭
 * - 反馈文案遵循"操作是否成功 / 系统发生了什么 / 下一步可以做什么"
 *   三段式，由调用方在 message 中提供完整文案
 */
type ToastVariant = "info" | "success" | "warn" | "danger";

interface ToastProps {
  id?: string | number;
  message: string;
  variant?: ToastVariant;
  /** 自动关闭时长（ms）；0 表示常驻，需手动 onClose */
  duration?: number;
  onClose?: () => void;
  className?: string;
}

const variantAccent: Record<ToastVariant, string> = {
  info: "before:bg-brand",
  success: "before:bg-ok-ink",
  warn: "before:bg-warn",
  danger: "before:bg-danger",
};

export function Toast({
  message,
  variant = "info",
  duration = 3200,
  onClose,
  className,
}: ToastProps) {
  useEffect(() => {
    if (!onClose || duration <= 0) return;
    const t = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(t);
  }, [onClose, duration]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "relative overflow-hidden rounded-md bg-ink px-4 py-3 text-sm text-on-dark shadow-3",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:content-['']",
        variantAccent[variant],
        className
      )}
    >
      <p className="whitespace-pre-line leading-relaxed">{message}</p>
      {onClose && duration === 0 && (
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭提示"
          className="ml-3 align-middle text-on-dark/70 hover:text-on-dark"
        >
          ×
        </button>
      )}
    </div>
  );
}

interface ToasterProps {
  toasts: ToastProps[];
  onDismiss?: (id: string | number) => void;
}

/**
 * Toast 容器：固定底部居中，按顺序堆叠。
 * 调用方维护 toasts 列表，单个 Toast 自动消失后调用 onDismiss。
 */
export function Toaster({ toasts, onDismiss }: ToasterProps) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div key={t.id ?? t.message} className="pointer-events-auto w-full max-w-[440px]">
          <Toast
            {...t}
            onClose={() => {
              t.onClose?.();
              if (t.id !== undefined) onDismiss?.(t.id);
            }}
          />
        </div>
      ))}
    </div>
  );
}

export type { ToastProps, ToastVariant };
