import { cn } from "@/lib/utils";
import type { OpportunityMatchStatus } from "@/lib/matching/types";

/**
 * 匹配状态标签：状态同时用「文字 + 符号 + 颜色」表达，绝不只靠颜色
 *（IA 第 1 节 / 验收“关键状态有文字”）。
 */
const STATUS_META: Record<
  OpportunityMatchStatus,
  { text: string; symbol: string; dotClass: string; textClass: string }
> = {
  preliminary_eligible: {
    text: "初步符合",
    symbol: "✓",
    dotClass: "bg-blue-600",
    textClass: "text-blue-700",
  },
  need_more_info: {
    text: "补充信息后判断",
    symbol: "?",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700",
  },
  manual_review: {
    text: "建议人工确认",
    symbol: "!",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700",
  },
  not_eligible: {
    text: "明确不符合",
    symbol: "×",
    dotClass: "bg-red-500",
    textClass: "text-red-700",
  },
};

export function MatchStatusTag({ status }: { status: OpportunityMatchStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium",
        meta.textClass,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white", meta.dotClass)}
      >
        {meta.symbol}
      </span>
      {meta.text}
    </span>
  );
}

/** 闸门失败（已截止 / 未收录等）的中性标签 */
export function ClosedTag({ text = "不在当前推荐" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-slate-500">
      <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-[10px] font-bold text-white">
        −
      </span>
      {text}
    </span>
  );
}
