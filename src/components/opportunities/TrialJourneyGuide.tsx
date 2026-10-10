import Link from "next/link";

interface TrialJourneyGuideProps {
  unitId: string;
  hasSavedOpportunity: boolean;
}

/**
 * 完整试用的轻量任务引导。只使用页面已经能确定的状态，
 * 不伪造“看过详情”等无法可靠判断的完成记录。
 */
export function TrialJourneyGuide({
  unitId,
  hasSavedOpportunity,
}: TrialJourneyGuideProps) {
  return (
    <section
      aria-labelledby="trial-journey-heading"
      className="rounded-xl border border-brand/25 bg-brand-soft/35 p-4"
    >
      <p className="text-xs font-semibold tracking-wide text-brand">完整体验指引</p>
      <h2 id="trial-journey-heading" className="mt-1 text-base font-semibold text-ink">
        {hasSavedOpportunity
          ? "机会已保存，继续体验材料和日程"
          : "下一步：核对一个虚构机会并保存"}
      </h2>
      <ol className="mt-3 grid gap-2 text-xs sm:grid-cols-3" aria-label="试用体验步骤">
        <TrialStep label="报考信息" state="done" />
        <TrialStep label="判断并保存" state={hasSavedOpportunity ? "done" : "current"} />
        <TrialStep label="材料与日程" state={hasSavedOpportunity ? "current" : "pending"} />
      </ol>
      <p className="mt-3 text-sm leading-6 text-ink-muted">
        {hasSavedOpportunity
          ? "系统已经建立材料进度与时间节点。以下内容仍是虚构试用数据，不可用于真实报名。"
          : "即使当前没有与你地区匹配的真实机会，也可以用虚构示例走完判断、保存、材料和日程流程。"}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium">
        {hasSavedOpportunity ? (
          <>
            <Link href="/applications" className="text-brand hover:underline">
              查看报考进度
            </Link>
            <Link href="/schedule" className="text-brand hover:underline">
              查看日程
            </Link>
          </>
        ) : (
          <Link href={`/opportunities/${unitId}`} className="text-brand hover:underline">
            打开虚构机会并查看依据
          </Link>
        )}
      </div>
    </section>
  );
}

function TrialStep({
  label,
  state,
}: {
  label: string;
  state: "done" | "current" | "pending";
}) {
  const stateLabel = state === "done" ? "已完成" : state === "current" ? "当前" : "待体验";
  return (
    <li className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-ink-muted ring-1 ring-line">
      <span
        aria-hidden="true"
        className={
          state === "done"
            ? "grid h-5 w-5 place-items-center rounded-full bg-brand text-[11px] font-bold text-white"
            : state === "current"
              ? "grid h-5 w-5 place-items-center rounded-full border-2 border-brand text-[10px] font-bold text-brand"
              : "grid h-5 w-5 place-items-center rounded-full border border-line text-[10px] text-ink-muted"
        }
      >
        {state === "done" ? "✓" : "·"}
      </span>
      <span>{label}</span>
      <span className="sr-only">{stateLabel}</span>
    </li>
  );
}
