"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "@/lib/auth";
import {
  CREDENTIAL_LEVEL_OPTIONS,
  guestSessionService,
  subjectLabel,
  type GuestProfileDraft,
} from "@/lib/guest/guestSession";
import { buildGuestPreview, type GuestPreview } from "@/lib/guest/previewEngine";
import { GUEST_COVERAGE } from "@/lib/guest/coverage";
import { getRollingDemoAnnouncements } from "@/lib/seed/demoTimeline";
import { Hero } from "@/components/ia/Hero";
import { OpportunityCard } from "@/components/ia/OpportunityCard";
import { Disclosure, LayerHeading } from "@/components/ia/Layer";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingPage } from "@/components/ui/Loading";
import { track, trackOncePerUser } from "@/lib/analytics/eventService";
import { USER_COPY } from "@/lib/ux/userCopy";
import { stageLabel } from "@/lib/ia/labels";
import type { GuestPreviewReady } from "@/lib/guest/previewEngine";
import type { ProfileLimitation } from "@/lib/guest/guestSession";

/**
 * v6.1 访客初步机会结果页：
 * 未登录完成五组画像后，立即看到按匹配程度排序的教师公开招聘机会。
 *
 * - 优先展示“初步符合”，其余机会按需要补充的条件分组，并说明为什么要补、影响几个机会；
 * - 每条机会都能展开看到逐项条件依据与官方来源；
 * - 未填写户籍/年龄等条件只显示“补充信息后判断”，绝不判为不符合；
 * - 未登录可完整查看，只有“关注/保存”一个主行动触发登录；
 * - 不生成 7 天备考计划；非语文学科显示“尚未开放 + 留下意向”终态。
 */
export default function PreviewPage() {
  const router = useRouter();
  const { status } = useCurrentUser();

  const [state] = useState<{ preview: GuestPreview | null; intentionLeft: boolean }>(() => {
    if (typeof window === "undefined") return { preview: null, intentionLeft: false };
    const session = guestSessionService.load();
    if (!session) return { preview: null, intentionLeft: false };
    const now = new Date();
    return {
      preview: buildGuestPreview(session.draft, getRollingDemoAnnouncements(now), now.toISOString()),
      intentionLeft: session.draft.intentionLeft === true,
    };
  });
  const [intentionLeft, setIntentionLeft] = useState(state.intentionLeft);
  const [intentionError, setIntentionError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "authenticated") {
      // 已登录用户有自己的机会主流程，访客预览不对其开放
      router.replace("/opportunities");
      return;
    }
    if (!state.preview || state.preview.kind === "incomplete") {
      router.replace("/onboarding");
    }
  }, [status, router, state.preview]);

  if (status === "loading") return <LoadingPage />;
  if (!state.preview || state.preview.kind === "incomplete") return <LoadingPage />;

  if (state.preview.kind === "subject_not_open") {
    return (
      <NotOpenSubject
        subjectLabel={state.preview.subjectLabel}
        intentionLeft={intentionLeft}
        error={intentionError}
        onLeaveIntention={() => {
          try {
            guestSessionService.save({ draft: { intentionLeft: true } });
            setIntentionLeft(true);
            setIntentionError(null);
          } catch {
            setIntentionError("本机存储不可用，意向没有保存，请检查浏览器存储设置后重试。");
          }
        }}
      />
    );
  }

  return <ReadyPreview preview={state.preview} />;
}

/* ================== 学科尚未开放终态 ================== */

function NotOpenSubject({
  subjectLabel,
  intentionLeft,
  error,
  onLeaveIntention,
}: {
  subjectLabel: string;
  intentionLeft: boolean;
  error: string | null;
  onLeaveIntention: () => void;
}) {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-lg mx-auto px-4 py-10">
        <Card className="text-center py-10">
          <div className="w-14 h-14 bg-warn-soft rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl" aria-hidden="true">🚧</span>
          </div>
          <h1 className="text-xl font-bold text-ink mb-2">
            「{subjectLabel}」教师公开招聘匹配尚未开放
          </h1>
          <p className="text-sm text-ink-muted leading-relaxed mb-6">
            当前先开放<strong className="text-ink">语文</strong>教师公开招聘。
            为了避免误导，我们不会用语文岗位为你生成不相关的匹配结果。
          </p>
          {intentionLeft ? (
            <div className="rounded-lg bg-success-soft border border-success/30 px-4 py-3 text-sm text-success">
              已在本机记录你对「{subjectLabel}」的开注意向。
              <p className="text-xs text-success mt-1">
                意向仅保存在当前浏览器，不会上传服务器；演示环境不会发送真实通知。
              </p>
            </div>
          ) : (
            <Button size="lg" fullWidth onClick={onLeaveIntention}>
              留下「{subjectLabel}」开注意向
            </Button>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          )}
          <p className="text-xs text-ink-muted mt-3">
            意向只保存在这台设备，不上传、不发送真实通知。
          </p>
        </Card>
        <p className="text-center text-sm text-ink-muted mt-6">
          想先看看语文机会？
          <Link href="/onboarding" className="text-brand hover:underline ml-1">
            返回修改学科
          </Link>
        </p>
      </div>
    </div>
  );
}

/* ================== 初步机会结果 ================== */

/** 真实监测事实行（与首页同一数据源）；下方 seed 机会必须明确标注为演示示例 */
function formatCoverageLine(): string {
  const d = new Date(GUEST_COVERAGE.lastCheckedAt);
  const day = Number.isNaN(d.getTime())
    ? GUEST_COVERAGE.lastCheckedAt
    : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  return `杭州、宁波语文教师渠道 · ${day}核对 · 当前在报 ${GUEST_COVERAGE.openOpportunityCount} 个`;
}

function ReadyPreview({ preview }: { preview: GuestPreviewReady }) {
  const { view, followUps, limitations, primaryAction } = preview;

  // P0 漏斗②：访客看到至少一个有效（初步符合）机会；同用户只记一次
  // 模块 0A 补缺口事件：初步结果曝光
  useEffect(() => {
    track("preview_revealed", "opportunity", {
      props: { validCount: view.validCount },
    });
    if (view.validCount > 0) {
      trackOncePerUser("opportunity_revealed", "opportunity", {
        targetId: view.priority?.unitId,
        props: { validCount: view.validCount },
      });
    }
    // 仅在预览结果首次展示时记录
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 首屏先看机会概要，需要时再展开逐项依据。
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());

  const toggleRow = (unitId: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const archivedCount =
    view.regionOutOfScope.length +
    view.notEligible.length +
    view.closedBuckets.reduce((sum, bucket) => sum + bucket.rows.length, 0);

  // 不适合优先展示的示例统一收进一个入口，避免页面先铺满多个结果分区。
  const archiveSections = archivedCount > 0 ? (
    <Disclosure title="查看暂不推荐的示例" count={archivedCount}>
      <div className="space-y-6">
        {view.regionOutOfScope.length > 0 && (
          <section className="space-y-3">
            <LayerHeading title="地区不在你选择的范围" count={view.regionOutOfScope.length} />
            <p className="text-xs leading-5 text-ink-muted">
              这些岗位只是地点不在你填写的可接受地区内，并不代表其他条件不符合。
            </p>
            {view.regionOutOfScope.map((row) => (
              <OpportunityCard
                key={row.unitId}
                row={row}
                regionOutOfScope
                expanded={openIds.has(row.unitId)}
                onToggle={() => toggleRow(row.unitId)}
              />
            ))}
          </section>
        )}

        {view.notEligible.length > 0 && (
          <section className="space-y-3">
            <LayerHeading title="条件暂不符合" count={view.notEligible.length} />
            {view.notEligible.map((row) => (
              <OpportunityCard
                key={row.unitId}
                row={row}
                expanded={openIds.has(row.unitId)}
                onToggle={() => toggleRow(row.unitId)}
              />
            ))}
          </section>
        )}

        {view.closedBuckets.map((bucket) => (
          <section key={bucket.key} className="space-y-3">
            <LayerHeading title={bucket.label} count={bucket.rows.length} />
            {bucket.rows.map((row) => (
              <OpportunityCard
                key={row.unitId}
                row={row}
                expanded={openIds.has(row.unitId)}
                onToggle={() => toggleRow(row.unitId)}
              />
            ))}
          </section>
        ))}
      </div>
    </Disclosure>
  ) : null;

  // 空数据：画像完整但已覆盖公告中没有可考虑机会
  if (!view.priority) {
    const missingRegion = limitations.some((item) => item.step === 1);
    const regionFollowUp = followUps.find((f) => f.dimension === "region");
    return (
      <div className="min-h-screen bg-canvas">
        <div className="mx-auto max-w-2xl space-y-4 py-6 px-4">
          <header>
            <p className="text-xs font-semibold tracking-wide text-brand">初步匹配结果</p>
            <h1 className="mt-1 text-xl font-bold text-ink">暂时没有可优先推进的机会</h1>
            <p className="mt-1 text-xs text-ink-muted">{formatCoverageLine()}</p>
          </header>
          <UncoveredRegionsCard regionLabels={view.uncoveredRegions.map((r) => r.label)} />
          {missingRegion && (
            <Card className="border-warn/30 bg-warn-soft/70" data-testid="missing-region-notice">
              <h2 className="text-sm font-semibold text-warn">
                你选择了暂不提供「能接受的地区」
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-warn">
                没有地区意向时不会给出任何「初步符合」结果
                {regionFollowUp ? `（当前 ${regionFollowUp.affectsCount} 个示例岗位都在等你补充地区）` : ""}
                ；这不是不符合，补充至少一个地区后结论会立即重新计算。
              </p>
              <LinkButton
                href="/onboarding"
                variant="primary"
                size="md"
                className="mt-3"
              >
                返回补充地区
              </LinkButton>
            </Card>
          )}
          <EmptyState
            title={
              missingRegion
                ? "补充地区后才能看到可考虑的机会"
                : "当前已覆盖的公告里还没有你能考虑的机会"
            }
            description="可以修改地区或学历等条件再看；未覆盖地区不等于没有招聘，新公告核对后会出现在这里。"
            actionLabel="修改报考信息"
            actionHref="/onboarding"
          />
          <SummaryCard />
          <LimitationsCard limitations={limitations} />
          {archiveSections}
        </div>
      </div>
    );
  }

  const priority = view.priority;
  const priorityStatusText =
    priority.status === "preliminary_eligible"
      ? "可能适合"
      : priority.status === "need_more_info"
        ? "补充信息后再判断"
        : priority.status === "manual_review"
          ? "需要向招聘单位确认"
          : "暂不符合";
  const otherPreliminary = view.preliminary.filter((row) => row.unitId !== priority.unitId);
  const moreResultCount =
    otherPreliminary.length +
    view.needInfoGroups.reduce((sum, group) => sum + group.rows.length, 0) +
    view.manualReview.length;

  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* 真实监测事实与虚构示例彻底分开，避免把示例误认成可报名机会。 */}
        <Hero
          meta="真实机会监测"
          conclusion={
            GUEST_COVERAGE.openOpportunityCount > 0
              ? `当前监测到 ${GUEST_COVERAGE.openOpportunityCount} 个正在报名的真实机会`
              : "当前没有监测到正在报名的真实机会"
          }
          risk={{ tone: "info", text: GUEST_COVERAGE.nextWindowNote }}
          action={
            primaryAction
              ? { label: primaryAction.label, href: primaryAction.href }
              : undefined
          }
        >
          <p className="text-xs leading-relaxed text-ink-muted">{formatCoverageLine()}</p>
        </Hero>

        {/* 示例判断：只解释产品会怎样帮助，不提供保存或报名动作。 */}
        <section id="demo-opportunity" className="scroll-mt-20 space-y-3">
          <div>
            <span className="inline-flex rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">
              功能示例 · 不是当前真实岗位
            </span>
            <h2 className="mt-2 text-lg font-semibold text-ink">看看以后会怎样帮你判断</h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              按你填写的信息，这个虚构机会会被标为「{priorityStatusText}」。
            </p>
          </div>
          <OpportunityCard
            row={priority}
            priority
            expanded={priorityOpen}
            onToggle={() => setPriorityOpen((v) => !v)}
          />
          <SummaryCard />
        </section>

        {moreResultCount > 0 && (
          <Disclosure title="查看其他示例判断" count={moreResultCount}>
            <div className="space-y-6">
              {otherPreliminary.length > 0 && (
                <section className="space-y-3">
                  <LayerHeading title="其他可能适合" count={otherPreliminary.length} />
                  {otherPreliminary.map((row) => (
                    <OpportunityCard key={row.unitId} row={row} expanded={openIds.has(row.unitId)} onToggle={() => toggleRow(row.unitId)} />
                  ))}
                </section>
              )}

              {followUps.map((followUp) => {
                const group = view.needInfoGroups.find((g) => g.dimension === followUp.dimension);
                if (!group) return null;
                return (
                  <section key={followUp.dimension} className="space-y-3">
                    <LayerHeading title={`补充${followUp.dimensionText}后再判断`} count={followUp.affectsCount} />
                    <p className="text-xs leading-5 text-ink-muted">{followUp.reason}</p>
                    {group.rows.map((row) => (
                      <OpportunityCard key={row.unitId} row={row} expanded={openIds.has(row.unitId)} onToggle={() => toggleRow(row.unitId)} />
                    ))}
                  </section>
                );
              })}

              {view.manualReview.length > 0 && (
                <section className="space-y-3">
                  <LayerHeading title="需要向招聘单位确认" count={view.manualReview.length} />
                  {view.manualReview.map((row) => (
                    <OpportunityCard key={row.unitId} row={row} expanded={openIds.has(row.unitId)} onToggle={() => toggleRow(row.unitId)} />
                  ))}
                </section>
              )}
            </div>
          </Disclosure>
        )}

        {archiveSections}

        {(limitations.length > 0 || view.uncoveredRegions.length > 0) && (
          <Disclosure title="为什么结果可能不完整">
            <div className="space-y-4">
              <LimitationsCard limitations={limitations} />
              <UncoveredRegionsCard regionLabels={view.uncoveredRegions.map((region) => region.label)} />
            </div>
          </Disclosure>
        )}

        <p className="text-center text-xs text-ink-muted">
          示例仅用于体验判断方式，不代表真实招聘。你填写的报考信息仅保存在这台设备，可随时
          <Link href="/onboarding" className="text-brand hover:underline mx-1">
            修改报考信息
          </Link>
          。
        </p>
      </div>
    </div>
  );
}

/* ================== 报考信息摘要：只保留一行关键内容 ================== */

/** 从访客草稿中拉取五项摘要，缺失项标"还不能判断" */
function SummaryCard() {
  if (typeof window === "undefined") return null;
  const session = guestSessionService.load();
  const draft: GuestProfileDraft | undefined = session?.draft;

  const regionText = draft?.regions?.length
    ? draft.regions
        .map((r) => [r.province, r.city].filter(Boolean).join("·"))
        .join("、")
    : USER_COPY.MATCH_STATUS.UNKNOWN;
  const educationText = draft?.educationLevel || draft?.degree
    ? [draft.educationLevel, draft.degree].filter(Boolean).join(" / ")
    : USER_COPY.MATCH_STATUS.UNKNOWN;
  const majorText = draft?.majorFullName?.trim() || USER_COPY.MATCH_STATUS.UNKNOWN;
  const educationLabel =
    CREDENTIAL_LEVEL_OPTIONS.find((option) => option.value === draft?.educationLevel)?.label ??
    educationText;
  const targetText = [
    draft?.teacherCert?.subject ? subjectLabel(draft.teacherCert.subject) : null,
    draft?.teacherCert?.stage ? stageLabel(draft.teacherCert.stage) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const summary = [regionText, educationLabel, majorText, targetText]
    .filter((value) => value && value !== USER_COPY.MATCH_STATUS.UNKNOWN)
    .join(" · ");

  return (
    <div
      data-testid="preview-summary"
      className="flex items-start justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-3"
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-muted">根据你的报考信息判断</p>
        <p className="mt-1 line-clamp-2 text-sm text-ink">
          {summary || "部分信息暂未填写"}
        </p>
      </div>
      <Link href="/onboarding" className="shrink-0 text-xs font-medium text-brand hover:underline">
        修改
      </Link>
    </div>
  );
}

/* ================== 画像地区暂未收录提示 ================== */

function UncoveredRegionsCard({ regionLabels }: { regionLabels: string[] }) {
  if (regionLabels.length === 0) return null;
  return (
    <section
      data-testid="uncovered-regions"
      className="rounded-2xl border border-dashed border-line bg-canvas px-4 py-3"
    >
      <h2 className="text-sm font-semibold text-ink">
        这些地区当前暂未收录官方公告
      </h2>
      <p className="mt-1 text-xs text-ink-muted">{regionLabels.join("、")}</p>
      <p className="mt-1.5 text-xs leading-5 text-ink-muted">
        暂未收录不等于当地没有招聘：可能公告尚未发布，或还没进入演示数据的覆盖范围。
        这里提供的是初步判断，报名前请以当地教育局或人社局官网为准。
      </p>
      <Link
        href="/onboarding"
        className="mt-2 inline-block text-xs font-medium text-brand underline underline-offset-2"
      >
        修改报考地区
      </Link>
    </section>
  );
}

/* ================== 最低必要信息缺失的结果限制卡 ================== */

function LimitationsCard({ limitations }: { limitations: ProfileLimitation[] }) {
  if (limitations.length === 0) return null;
  return (
    <section
      aria-label="暂未提供信息导致的结果限制"
      data-testid="profile-limitations"
      className="rounded-2xl border border-warn/30 bg-warn-soft/70 px-4 py-3"
    >
      <h2 className="text-sm font-semibold text-warn">
        有 {limitations.length} 项信息你暂未提供，结果已相应收窄
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {limitations.map((item) => (
          <li key={item.step} className="text-xs leading-relaxed text-warn">
            <span className="font-medium">{item.label}：</span>
            {item.impact}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-warn">
        没有填写的信息一律显示「补充信息后判断」，不会被判为不符合；
        <Link href="/onboarding" className="font-medium underline underline-offset-2 ml-1">
          返回补填
        </Link>
        后结果自动更新。
      </p>
    </section>
  );
}
