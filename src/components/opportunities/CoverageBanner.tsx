import type { CoverageDTO } from "@/lib/opportunities/api-types";

/** "YYYY-MM-DD..." → "M月D日"；无法解析时原样返回 */
function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 真实监测覆盖说明（模块 1）：
 * 说清「实际覆盖哪些地区、最近核对时间、当前是否有在报批次」，
 * 避免把「暂未收录」误读成「当地无招聘」。
 */
export function CoverageBanner({ coverage }: { coverage: CoverageDTO }) {
  const regionText = coverage.regions.map((r) => r.label).join("、");
  return (
    <details
      aria-label="官方监测覆盖说明"
      className="group rounded-2xl border border-line bg-surface"
      data-testid="coverage-banner"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="m5 12 4 4L19 6"
              />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">
              官方来源已核对 · {regionText}
            </span>
            <span className="mt-0.5 block text-xs text-ink-muted">
              {formatDay(coverage.lastCheckedAt)} 更新 · 点击查看监测范围
            </span>
          </span>
        </span>
        <svg
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" />
        </svg>
      </summary>

      <div className="border-t border-line px-4 pb-4 pt-3">
        <p className="text-sm text-ink">
          当前监测到{" "}
          <span className="font-semibold">
            {coverage.openOpportunityCount} 个在报语文教师岗位
          </span>
          ；{coverage.nextWindowNote}
        </p>

        <ul className="mt-3 space-y-1.5 text-xs text-ink-muted">
          {coverage.regions.flatMap((region) =>
            region.sources.map((source) => (
              <li
                key={source.id}
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
              >
                <span
                  aria-hidden="true"
                  className={
                    source.ok
                      ? "inline-block h-1.5 w-1.5 rounded-full bg-success"
                      : "inline-block h-1.5 w-1.5 rounded-full bg-danger"
                  }
                />
                <span>
                  {region.label} · {source.name}
                </span>
                <span>
                  {source.ok ? "来源可访问" : `来源异常：${source.failReason ?? "未知原因"}`}
                </span>
                <span>核对于 {formatDay(source.lastCheckedAt)}</span>
              </li>
            )),
          )}
        </ul>

        <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-muted">
          {coverage.scopeNote}
          AI 初核且尚待人工复核的记录不会进入推荐。覆盖版本 {coverage.version}。
        </p>
      </div>
    </details>
  );
}
