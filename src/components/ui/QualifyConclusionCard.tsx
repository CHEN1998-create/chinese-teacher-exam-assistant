import { cn } from "@/lib/utils";
import { ReactNode } from "react";

/**
 * 资格结论卡（v7 原型四档匹配状态分层表达）
 *
 * 四档对应资格判断领域模型的 PASS / UNKNOWN / 需用户确认 / FAIL：
 * - ok      建议重点关注        (ok-bg / ok-ink / ok-line)
 * - miss    信息补充后再判断    (miss-bg / miss-ink / miss-line)
 * - ask     需要用户确认        (ask-bg / ask-ink / ask-line)
 * - no      当前条件可能不符合  (no-bg / no-ink / no-line)
 *
 * 不只靠颜色表达状态：标签文字直接写明档位语义，避免色盲误读。
 * 不写死结论：reasons 由调用方传入（基于 evaluateRegion 等领域逻辑）。
 */
export type QualifyLevel = "ok" | "miss" | "ask" | "no";

interface QualifyConclusionCardProps {
  level: QualifyLevel;
  label: string;
  summary: string;
  reasons?: string[];
  nextActions?: ReactNode[];
  updatedAt?: string;
  className?: string;
}

const levelStyles: Record<
  QualifyLevel,
  { box: string; tag: string; tagText: string }
> = {
  ok: {
    box: "bg-ok-bg border-ok-line text-ok-ink",
    tag: "bg-ok-bg text-ok-ink border-ok-line",
    tagText: "建议重点关注",
  },
  miss: {
    box: "bg-miss-bg border-miss-line text-miss-ink",
    tag: "bg-miss-bg text-miss-ink border-miss-line",
    tagText: "信息补充后再判断",
  },
  ask: {
    box: "bg-ask-bg border-ask-line text-ask-ink",
    tag: "bg-ask-bg text-ask-ink border-ask-line",
    tagText: "需要你确认",
  },
  no: {
    box: "bg-no-bg border-no-line text-no-ink",
    tag: "bg-no-bg text-no-ink border-no-line",
    tagText: "当前条件可能不符合",
  },
};

export function QualifyConclusionCard({
  level,
  label,
  summary,
  reasons,
  nextActions,
  updatedAt,
  className,
}: QualifyConclusionCardProps) {
  const s = levelStyles[level];
  return (
    <section
      aria-label="资格结论"
      className={cn(
        "rounded-lg border p-4 grid gap-3",
        s.box,
        className
      )}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-semibold",
            s.tag
          )}
        >
          {label || s.tagText}
        </span>
        {updatedAt && (
          <span className="text-xs text-ink-muted/70">更新于 {updatedAt}</span>
        )}
      </header>
      <p className="text-sm leading-relaxed">{summary}</p>
      {reasons && reasons.length > 0 && (
        <ul className="grid gap-1.5 text-sm">
          {reasons.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden="true" className="mt-2 w-1 h-1 rounded-full bg-current flex-none" />
              <span className="min-w-0">{r}</span>
            </li>
          ))}
        </ul>
      )}
      {nextActions && nextActions.length > 0 && (
        <div className="mt-1 grid gap-2">
          {nextActions.map((action, i) => (
            <div key={i}>{action}</div>
          ))}
        </div>
      )}
    </section>
  );
}
