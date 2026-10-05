"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Hero } from "@/components/ia/Hero";
import { LayerHeading } from "@/components/ia/Layer";
import { MatchStatusTag, ClosedTag } from "@/components/ia/MatchStatusTag";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingPage } from "@/components/ui/Loading";
import {
  deadlineText,
  natureShortLabel,
  regionLabel,
  stageLabel,
} from "@/lib/ia/labels";
import { MATCH_STATUS_LABELS } from "@/lib/matching/types";
import { opportunitiesApi } from "@/lib/opportunities/api";
import type {
  FollowStatus,
  StudyTargetRole,
  UnitDetailResponse,
} from "@/lib/opportunities/api-types";
import {
  failedGates,
  groupDimensions,
  nextAction,
} from "@/lib/opportunities/detail-view";
import { useActiveProfile } from "@/lib/opportunities/useOpportunities";
import {
  buildActiveProfile,
  supplementFactsService,
  type SupplementFacts,
} from "@/lib/profile/activeProfile";
import type { UserRecruitmentProfile } from "@/lib/profile/types";
import { ConditionRows } from "@/components/opportunities/ConditionRows";
import { FollowControls } from "@/components/opportunities/FollowControls";
import { SupplementForm } from "@/components/opportunities/SupplementForm";
import { EvidenceSection } from "@/components/opportunities/EvidenceSection";
import { CorrectionModal } from "@/components/opportunities/CorrectionModal";
import { track, trackView } from "@/lib/analytics/eventService";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

export default function OpportunityDetailPage() {
  const params = useParams<{ unitId: string }>();
  const unitId = params?.unitId ?? "";
  const router = useRouter();
  const profileState = useActiveProfile();

  const [detail, setDetail] = useState<UnitDetailResponse | null>(null);
  const [loading, setLoading] = useState(
    () => profileState.status === "ready",
  );
  const [error, setError] = useState<string | null>(null);
  const [facts, setFacts] = useState<SupplementFacts>(() =>
    supplementFactsService.load(),
  );
  const [savingFacts, setSavingFacts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);
  const [correctionDone, setCorrectionDone] = useState(false);

  // 手动重试 / 补充信息后重拉：事件处理器中调用，可以同步切 loading
  const loadDetail = useCallback(
    async (profile: UserRecruitmentProfile) => {
      setLoading(true);
      setError(null);
      try {
        const response = await opportunitiesApi.unitDetail(unitId, profile);
        setDetail(response);
        // P0 漏斗③：打开详情即看到逐项官方依据（同一会话每机会只记一次）
        trackView(unitId, "match_basis_viewed", "opportunity", {
          targetId: unitId,
          props: { fieldCount: response.unit.dimensions.length },
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "详情加载失败");
      } finally {
        setLoading(false);
      }
    },
    [unitId],
  );

  // 首次加载：setState 均在异步回调中，避免渲染级联
  useEffect(() => {
    if (profileState.status !== "ready") return;
    let cancelled = false;
    opportunitiesApi
      .unitDetail(unitId, profileState.profile)
      .then((response) => {
        if (!cancelled) {
          setDetail(response);
          // P0 漏斗③：打开详情即看到逐项官方依据（同一会话每机会只记一次）
          trackView(unitId, "match_basis_viewed", "opportunity", {
            targetId: unitId,
            props: { fieldCount: response.unit.dimensions.length },
          });
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "详情加载失败");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [unitId, profileState]);

  if (loading) return <LoadingPage />;

  if (profileState.status === "no-profile") {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          title="先完成基础画像，才能查看这项机会的匹配依据"
          description="机会详情中的每个结论都由后端按你的画像即时计算。"
          actionLabel="去完成基础画像"
          actionHref="/onboarding"
        />
      </div>
    );
  }

  // 到此分支 profileState 必然 ready（上面已对 loading/no-profile 提前返回）
  const profile = profileState.profile;

  if (error || !detail) {
    return (
      <ErrorState
        title="机会详情加载失败"
        description={
          error ?? "未找到该报考单元，它可能不属于当前已发布公告版本。"
        }
        onRetry={() => void loadDetail(profile)}
      />
    );
  }

  const unit = detail.unit;
  const groups = groupDimensions(unit.dimensions);
  const failed = failedGates(unit.gates);
  const closed = failed.length > 0;
  const action = nextAction(unit);
  const deadline = deadlineText(
    unit.version.timeline.registrationEnd,
    detail.meta.evaluatedAt,
  );

  const heroAction = (() => {
    const base = { label: action.label };
    if (action.href) {
      return { ...base, href: action.href, external: action.external };
    }
    if (action.kind === "supplement") {
      return { ...base, onClick: () => scrollToId("supplement") };
    }
    if (action.kind === "confirm") {
      return { ...base, onClick: () => scrollToId("to-confirm") };
    }
    if (action.kind === "reviewFail") {
      return { ...base, onClick: () => scrollToId("unsatisfied") };
    }
    if (action.kind === "follow") {
      return {
        ...base,
        onClick: () => void followUnit(),
      };
    }
    if (action.kind === "prepare") {
      // 必须走 handleTransition：首屏主行动与下方跟进区共用同一条状态流转与
      // P0 漏斗⑥埋点，不能只调 API 导致主行动路径漏记 follow_status_changed。
      return {
        ...base,
        onClick: () => void handleTransition("preparing"),
      };
    }
    // waiting / registered：滚动到跟进区（register/official 已在前面处理外链）
    return { ...base, onClick: () => scrollToId("follow") };
  })();

  /** 用最新本机画像（含刚保存的补充事实）重新拉取后端结论 */
  function refreshDetail() {
    const active = buildActiveProfile();
    if (!active.ready) return Promise.resolve();
    return loadDetail(active.profile);
  }

  async function runAction(
    fn: () => Promise<unknown>,
    options?: { redirectAfter?: boolean },
  ) {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      if (options?.redirectAfter) {
        router.push("/opportunities");
        return;
      }
      await refreshDetail();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  /** 关注成功后埋点（失败由 runAction 捕获，不会产生事件） */
  const followUnit = () =>
    runAction(async () => {
      await opportunitiesApi.follow(unitId);
      // P0 漏斗④：关注机会
      track("opportunity_followed", "opportunity", {
        targetId: unitId,
        props: { from: detail?.unit.overall ?? "unknown" },
      });
    });

  const handleTransition = (
    status: FollowStatus,
    opts?: { note?: string; abandonReason?: string },
  ) =>
    runAction(async () => {
      const from = unit.follow?.status ?? "considering";
      await opportunitiesApi.transition(unitId, status, opts);
      // P0 漏斗⑥：标记准备报名/已报名（含其他报名状态流转）
      track("follow_status_changed", "opportunity", {
        targetId: unitId,
        props: { from, to: status },
      });
    });

  const handleSetRole = (role: StudyTargetRole) =>
    runAction(async () => {
      await opportunitiesApi.setRole(unitId, role);
      // P0 漏斗⑦：设为主要目标
      if (role === "primary") {
        track("primary_target_set", "opportunity", { targetId: unitId });
      }
    });

  const handleSaveFacts = async (next: SupplementFacts) => {
    setSavingFacts(true);
    setActionError(null);
    try {
      const saved = supplementFactsService.save(next);
      setFacts(saved);
      // 必须重新装配画像：保存后的补充事实要参与后端重算，
      // 不能复用首屏缓存的 profile。
      await refreshDetail();
      // P0 漏斗⑤：补充资格信息成功并触发重算（只记维度与字段数，不含答案）
      const dims = {
        age: saved.birthDate !== undefined,
        hukou: saved.hukouProvinceCode !== undefined,
        social_security: saved.socialSecurityMonths !== undefined,
        work_experience: saved.workExperienceMonths !== undefined,
        other: Object.keys(saved.extraAnswers ?? {}).length > 0,
      };
      const fieldCount = Object.values(dims).filter(Boolean).length;
      if (fieldCount > 0) {
        track("qualification_supplemented", "profile", {
          targetId: unitId,
          props: {
            fieldCount,
            age: dims.age ? 1 : 0,
            hukou: dims.hukou ? 1 : 0,
            social_security: dims.social_security ? 1 : 0,
            work_experience: dims.work_experience ? 1 : 0,
            other: dims.other ? 1 : 0,
          },
        });
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSavingFacts(false);
    }
  };

  const handleCorrection = async (input: {
    fieldPath: string;
    content: string;
    contact?: string;
  }) => {
    setCorrectionSubmitting(true);
    setActionError(null);
    try {
      await opportunitiesApi.submitCorrection(unitId, input);
      setCorrectionOpen(false);
      setCorrectionDone(true);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "纠错提交失败");
    } finally {
      setCorrectionSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-4">
      <nav className="text-xs text-slate-500">
        <Link
          href="/opportunities"
          className="underline underline-offset-2 hover:text-blue-700"
        >
          ← 返回机会列表
        </Link>
      </nav>

      {/* 标题区 */}
      <header className="space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-semibold leading-snug text-slate-900">
            {unit.unit.name}
          </h1>
          {closed ? <ClosedTag /> : <MatchStatusTag status={unit.overall} />}
        </div>
        <p className="text-sm text-slate-500">
          {regionLabel(unit.unit.region)} ·{" "}
          {unit.unit.employmentNature.officialName}（
          {natureShortLabel(unit.unit.employmentNature.code as never)}） ·{" "}
          {stageLabel(unit.unit.stage)} · 招 {unit.unit.headcount} 人
        </p>
        <p className="text-sm text-slate-500">
          {unit.announcement.publisher} · 报名
          {closed ? "" : deadline.text}
        </p>
        {unit.follow?.newerVersion && (
          <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
            你关注时依据的公告版本已有更新，当前展示的是最新已发布版本。
          </p>
        )}
      </header>

      {/* 第一层：结论 + 唯一下一步 */}
      <Hero
        meta={`${MATCH_STATUS_LABELS[unit.overall]} · 依据规则 ${detail.meta.ruleVersion}`}
        conclusion={unit.summary}
        action={busy ? { ...heroAction, disabled: true, label: "处理中…" } : heroAction}
      >
        {failed.length > 0 && (
          <ul className="space-y-1 text-sm text-slate-500">
            {failed.map((gate) => (
              <li key={gate.code}>· {gate.reason}</li>
            ))}
          </ul>
        )}
      </Hero>

      {actionError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {actionError}
        </p>
      )}
      {correctionDone && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          纠错已提交并留痕，我们会核对官方原文；如需更正将通过新版本发布，不会直接改动结论。
        </p>
      )}

      {/* 跟进与备考目标 */}
      <div id="follow" className="scroll-mt-20">
        <FollowControls
          follow={unit.follow}
          unitName={unit.unit.name}
          busy={busy}
          onFollow={() => void followUnit()}
          onTransition={(status, opts) => void handleTransition(status, opts)}
          onSetRole={(role) => void handleSetRole(role)}
          onUnfollow={() =>
            void runAction(
              async () => opportunitiesApi.unfollow(unitId),
              { redirectAfter: true },
            )
          }
        />
      </div>

      {/* 第二层：已满足 / 待确认 / 不满足 */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">
          逐项资格核对
        </h2>

        {groups.toConfirm.length > 0 && (
          <div
            id="to-confirm"
            className="scroll-mt-20 rounded-xl border border-amber-200 bg-white"
          >
            <div className="border-b border-amber-100 px-4 py-2.5">
              <LayerHeading
                title="待确认（信息不足或需人工确认）"
                count={groups.toConfirm.length}
              />
            </div>
            <div className="px-4 py-2">
              <ConditionRows
                dimensions={groups.toConfirm}
                showDescription
              />
            </div>
          </div>
        )}

        {groups.unsatisfied.length > 0 && (
          <div
            id="unsatisfied"
            className="scroll-mt-20 rounded-xl border border-red-200 bg-white"
          >
            <div className="border-b border-red-100 px-4 py-2.5">
              <LayerHeading title="不满足" count={groups.unsatisfied.length} />
            </div>
            <div className="px-4 py-2">
              <ConditionRows
                dimensions={groups.unsatisfied}
                showDescription
              />
            </div>
          </div>
        )}

        {groups.satisfied.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-2.5">
              <LayerHeading title="已满足" count={groups.satisfied.length} />
            </div>
            <div className="px-4 py-2">
              <ConditionRows dimensions={groups.satisfied} showDescription />
            </div>
          </div>
        )}
      </section>

      {/* 补充信息（只影响当前画像，提交后即时重算） */}
      <div id="supplement" className="scroll-mt-20">
        <SupplementForm
          dimensions={groups.toConfirm}
          initial={facts}
          saving={savingFacts}
          onSave={(next) => void handleSaveFacts(next)}
        />
      </div>

      {/* 第三层：官方原文 / 证据 / 版本 / 纠错 */}
      <EvidenceSection
        detail={detail}
        onOpenCorrection={() => {
          setCorrectionDone(false);
          setCorrectionOpen(true);
        }}
      />

      <CorrectionModal
        isOpen={correctionOpen}
        onClose={() => setCorrectionOpen(false)}
        submitting={correctionSubmitting}
        onSubmit={(input) => void handleCorrection(input)}
      />
    </div>
  );
}
