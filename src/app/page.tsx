"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/layout/BrandMark";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { Disclosure } from "@/components/ui/Disclosure";
import { LoadingPage } from "@/components/ui/Loading";
import { useCurrentUser } from "@/lib/auth";
import { guestSessionService } from "@/lib/guest/guestSession";
import { GUEST_COVERAGE } from "@/lib/guest/coverage";
import { track } from "@/lib/analytics/eventService";

/** "YYYY-MM-DD..." → "YYYY年M月D日"；无法解析时原样返回 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

const SOURCE_COUNT = GUEST_COVERAGE.regions.reduce(
  (sum, region) => sum + region.sources.length,
  0,
);

/**
 * 首页路由规则（v6.1 模块 0A 双入口混合式）：
 * - 已登录 → 默认进入「机会」/opportunities；
 * - 未登录且画像问答进行到一半 → 回到 /onboarding；
 * - 未登录且已看完初步结果 → /preview；
 * - 其余访客 → 价值首页（本页内容，无需登录）。
 *
 * 首屏只保留：品牌、核心价值、一句可信说明、一行覆盖摘要、主按钮"开始匹配"、
 * "先了解"文字入口；完整覆盖范围与依据进入按需展开。
 */
export default function Home() {
  const router = useRouter();
  const { status } = useCurrentUser();

  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated") {
      router.replace("/opportunities");
      return;
    }

    if (guestSessionService.isInProgress()) {
      router.replace("/onboarding");
      return;
    }
    if (guestSessionService.isComplete()) {
      router.replace("/preview");
    }
  }, [status, router]);

  if (status === "loading") return <LoadingPage />;

  const regionText = GUEST_COVERAGE.regions.map((r) => r.label).join("、");

  const handleStart = () => {
    track("home_start_match_clicked", "home");
    router.push("/onboarding");
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="mx-auto flex h-18 w-full max-w-6xl items-center justify-between px-5 md:h-20 md:px-8">
        <BrandMark size="md" />
        <LinkButton href="/login" variant="ghost" size="sm" className="text-ink-muted">
          登录
        </LinkButton>
      </header>

      <main className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-12 pt-8 md:px-8 md:pb-16 md:pt-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-20">
        <section>
          <p className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
            教师招聘报考助手
          </p>

          <h1 className="mt-5 max-w-2xl text-[34px] font-bold leading-[1.18] tracking-[-0.035em] text-ink sm:text-[42px] md:text-5xl">
            先确认能不能报，
            <span className="text-brand">再决定要不要准备</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-ink-muted md:text-lg">
            回答 5 组关键信息，获得基于官方公告的初步判断。
            不确定的条件会单独标出，不让你自己猜。
          </p>

          <div className="mt-8 flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:items-center">
            <Button
              size="lg"
              onClick={handleStart}
              data-testid="start-onboarding"
              className="w-full sm:w-auto sm:min-w-44"
              iconEnd={
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 10h12m-4-4 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            >
              看看我可能能报哪些
            </Button>
            <LinkButton
              href="/learn"
              variant="ghost"
              data-testid="open-learn"
              className="h-[52px] text-sm text-ink-muted"
            >
              先看看怎么判断
            </LinkButton>
          </div>

          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted" aria-label="使用说明">
            {["无需注册", "答案只存在本机", "结论附官方依据"].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <svg aria-hidden="true" className="h-4 w-4 text-success" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m5 10 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section
          className="relative overflow-hidden rounded-[28px] border border-line bg-surface p-5 shadow-[0_24px_70px_rgba(42,69,112,0.1)] sm:p-7"
          aria-label="初步判断示例"
        >
          <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-full bg-brand-soft" aria-hidden="true" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">完成后你会看到</p>
                <h2 className="mt-1.5 text-xl font-bold text-ink">清楚的初步判断</h2>
              </div>
              <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">结果示例</span>
            </div>

            <div className="mt-6 rounded-2xl border border-success/15 bg-success-soft p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-success shadow-sm">
                  <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m5 10 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-success">初步判断</p>
                  <p className="mt-0.5 text-lg font-bold text-ink">初步符合</p>
                  <p className="mt-1 text-sm leading-6 text-ink-muted">适合你的机会优先显示，风险条件单独提醒。</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
              {[
                ["01", "逐项核对", "学历、专业等"],
                ["02", "标出缺口", "不确定不误判"],
                ["03", "附上依据", "可回看原公告"],
              ].map(([number, title, description]) => (
                <div key={number} className="rounded-2xl border border-line bg-canvas/70 p-3.5">
                  <span className="text-xs font-bold text-brand">{number}</span>
                  <p className="mt-2 text-sm font-semibold text-ink">{title}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-5 pb-10 md:px-8">
        <div className="relative flex flex-col gap-3 border-t border-line pt-5 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p data-testid="home-coverage-summary">
            当前覆盖：{regionText} · 语文教师岗位
          </p>
          <Disclosure
            trigger="覆盖范围与判断依据"
            triggerVariant="ghost"
            contentClassName="mt-2 rounded-2xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink-muted sm:absolute sm:right-8 sm:z-10 sm:w-[480px] sm:shadow-xl"
          >
            <dl className="grid gap-2 sm:grid-cols-2">
              <div><dt className="text-xs text-ink-muted">最近核对</dt><dd className="mt-0.5 font-medium text-ink">{formatDate(GUEST_COVERAGE.lastCheckedAt)}</dd></div>
              <div><dt className="text-xs text-ink-muted">官方来源</dt><dd className="mt-0.5 font-medium text-ink">共 {SOURCE_COUNT} 个</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-ink-muted">下一窗口</dt><dd className="mt-0.5 font-medium text-ink">{GUEST_COVERAGE.nextWindowNote}</dd></div>
            </dl>
            <p className="mt-3 border-t border-line pt-3 text-xs">{GUEST_COVERAGE.scopeNote}</p>
            <p className="mt-2 text-xs">初步判断不是官方审核，最终以招聘单位认定为准。</p>
          </Disclosure>
        </div>
      </footer>
    </div>
  );
}
