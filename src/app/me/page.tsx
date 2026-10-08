"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { Badge } from "@/components/ui/Badge";
import { useCurrentUser, AUTH_MODE } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo/config";
import { formatDateTime } from "@/lib/utils";
import { STAFF_ROLES } from "@/types";
import {
  buildActiveProfile,
  supplementFactsService,
} from "@/lib/profile/activeProfile";
import { profileApi } from "@/lib/profile/profileApi";
import {
  CREDENTIAL_LEVEL_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  subjectLabel,
  TEACHER_CERT_STATUS_OPTIONS,
} from "@/lib/guest/guestSession";
import { stageLabel } from "@/lib/ia/labels";
import { opportunitiesApi } from "@/lib/opportunities/api";
import type {
  GoalsResponse,
  OpportunityCorrectionDTO,
  OpportunityCorrectionStatus,
} from "@/lib/opportunities/api-types";
import type { UserRecruitmentProfile } from "@/lib/profile/types";

const AUTH_MODE_INVITED = AUTH_MODE === "invited";

const CORRECTION_STATUS_META: Record<
  OpportunityCorrectionStatus,
  { label: string; variant: "warning" | "info" | "success" | "muted" }
> = {
  submitted: { label: "待核对", variant: "warning" },
  reviewing: { label: "核对中", variant: "info" },
  resolved: { label: "已修正", variant: "success" },
  rejected: { label: "不采纳", variant: "muted" },
};

/**
 * 「我的」（v7.0 信息架构）：个人画像、报考偏好、备考次级入口、
 * 纠错记录、通知、隐私与账号设置的统一入口。
 * 不设置独立「备考」主导航：备考入口仅在用户已设置主要目标时出现。
 */
export default function MePage() {
  const { user, role, hasRole, logout } = useCurrentUser();

  if (!user || !role) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-4">
      <header>
        <p className="text-xs font-semibold tracking-wide text-brand">我的空间</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
          {user.name}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">管理画像、备考入口与提醒偏好</p>
      </header>

      {/* 个人画像 */}
      <ProfileCard />

      {/* 备考（次级入口：仅已设置主要目标时出现） */}
      <StudyEntryCard />

      {/* 我的纠错 */}
      <MyCorrectionsCard />

      {/* 次级入口集中收纳，避免与首屏主行动竞争 */}
      <Card>
        <CardHeader
          title="更多管理"
          description="资料、提醒、隐私与账号设置"
        />
        <div className="divide-y divide-line">
          <SettingsRow
            href="/materials"
            title="学习资料"
            description="管理已有资料及其适用方式"
          />
          <SettingsRow
            href="/settings"
            title="通知与学习偏好"
            description="管理学习提醒、考情变化与每日可用时间"
          />
          <SettingsRow
            href="/settings"
            title="隐私与数据"
            description="查看我们保存的数据类别，申请删除测试数据或注销账号"
          />
        </div>
      </Card>

      <details className="group rounded-2xl border border-line bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-ink">
              账号信息
              <Badge variant="primary">
                {role === "admin"
                  ? "管理员"
                  : role === "exam_reviewer"
                    ? "考情审核员"
                    : role === "resource_reviewer"
                      ? "资源审核员"
                      : "受邀用户"}
              </Badge>
            </span>
            <span className="mt-0.5 block text-xs text-ink-muted">用户ID：{user.id}</span>
          </span>
          <svg aria-hidden="true" className="h-4 w-4 text-ink-muted transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <div className="flex flex-wrap gap-2 border-t border-line p-4">
          <Button variant="outline" size="sm" onClick={() => void logout()}>
            退出登录
          </Button>
          {hasRole(STAFF_ROLES) && !isDemoMode && (
            <LinkButton href="/admin/corrections" variant="outline" size="sm">
              进入运营后台
            </LinkButton>
          )}
        </div>
      </details>
    </div>
  );
}

function SettingsRow({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors first:pt-0 last:pb-0 hover:bg-canvas/60"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="block text-xs text-ink-muted mt-0.5">{description}</span>
      </span>
      <span className="text-ink-muted" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}

function ProfileCard() {
  // 本地演示：画像来自 localStorage，惰性初始化即可，无需 effect 内同步 setState；
  // invited：初始为加载态，由 effect 异步拉取服务端画像后更新。
  const [profile, setProfile] = useState<UserRecruitmentProfile | null>(() => {
    if (AUTH_MODE_INVITED) return null;
    const active = buildActiveProfile();
    return active.ready ? active.profile : null;
  });
  const [loaded, setLoaded] = useState(!AUTH_MODE_INVITED);

  useEffect(() => {
    if (!AUTH_MODE_INVITED) return;
    let cancelled = false;
    profileApi.getProfile().then((persisted) => {
      if (cancelled) return;
      setProfile(persisted);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) {
    return (
      <Card>
        <p className="text-sm text-ink-muted">画像加载中…</p>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card className="rounded-3xl border-brand/15 p-5 shadow-[0_12px_36px_rgba(30,64,120,0.07)]">
        <p className="text-xs font-semibold tracking-wide text-brand">当前结论</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          先完成基础画像
        </h2>
        <p className="mt-2 text-sm text-ink-muted">完成后才能看到与你有关的机会判断。</p>
        <LinkButton href="/onboarding" variant="primary" size="lg" fullWidth className="mt-5">
          开始基础画像
        </LinkButton>
      </Card>
    );
  }

  const facts = supplementFactsService.load();
  const supplementCount = [
    facts.birthDate,
    facts.hukouCityCode ?? facts.hukouProvinceCode,
    facts.socialSecurityMonths !== undefined,
    facts.workExperienceMonths !== undefined,
  ].filter(Boolean).length + (facts.extraAnswers ? Object.keys(facts.extraAnswers).length : 0);

  const rows: { label: string; value: string }[] = [
    {
      label: "意向地区",
      value:
        profile.regions.map((r) => [r.province, r.city].filter(Boolean).join(" ")).join("、") ||
        "未填写",
    },
    {
      label: "学历 / 学位",
      value: [
        CREDENTIAL_LEVEL_OPTIONS.find((o) => o.value === profile.educationLevel)?.label,
        profile.degree && profile.degree !== "none"
          ? { bachelor: "学士", master: "硕士", doctorate: "博士" }[profile.degree]
          : null,
      ]
        .filter(Boolean)
        .join(" / "),
    },
    { label: "毕业证专业", value: profile.majorFullName || "未填写" },
    {
      label: "毕业与就业状态",
      value:
        [
          profile.graduationDate,
          EMPLOYMENT_STATUS_OPTIONS.find((o) => o.value === profile.employmentStatus)?.label,
        ]
          .filter(Boolean)
          .join(" · ") || "未填写",
    },
    {
      label: "教师资格",
      value:
        TEACHER_CERT_STATUS_OPTIONS.find((o) => o.value === profile.teacherCert.status)?.label ??
        "未填写",
    },
    {
      label: "按需补充的信息",
      value:
        supplementCount > 0 ? `已补充 ${supplementCount} 项（年龄/户籍/社保等）` : "暂无补充",
    },
  ];
  const missingGraduationDate = !profile.graduationDate;
  const regionSummary = rows[0]?.value ?? "已填写意向地区";
  const targetSummary = [
    profile.teacherCert.subject ? subjectLabel(profile.teacherCert.subject) : null,
    profile.teacherCert.stage ? stageLabel(profile.teacherCert.stage) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="rounded-3xl border-brand/15 p-5 shadow-[0_12px_36px_rgba(30,64,120,0.07)]">
      <p className="text-xs font-semibold tracking-wide text-brand">画像结论</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        {missingGraduationDate
          ? "补充毕业时间，机会判断会更准确"
          : "画像已就绪，机会匹配会自动更新"}
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        当前画像：{regionSummary}{targetSummary ? ` · ${targetSummary}` : ""}
      </p>
      <LinkButton href="/onboarding" variant="primary" size="lg" fullWidth className="mt-5">
        {missingGraduationDate ? "补充画像信息" : "编辑我的画像"}
      </LinkButton>
      <details className="group mt-3 rounded-xl border border-line bg-canvas/60">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
          查看已填写内容
          <span className="text-ink-muted transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <dl className="divide-y divide-line border-t border-line px-3">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between gap-4 py-2.5 text-sm">
              <dt className="shrink-0 text-ink-muted">{row.label}</dt>
              <dd className="text-right text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </Card>
  );
}

/** 备考次级入口：只有已设置主要目标的用户才看得到；无后端/无目标时不渲染 */
function StudyEntryCard() {
  const [primary, setPrimary] = useState<GoalsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    opportunitiesApi
      .getGoals()
      .then((data) => {
        if (!cancelled && data.primaryTargetUnitId) setPrimary(data);
      })
      .catch(() => {
        // 公开演示无后端或尚无关注：不展示备考入口（v7.0 不设独立备考主导航）
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!primary || !primary.primaryTargetUnitId) return null;
  const target = primary.goals.find((g) => g.unitId === primary.primaryTargetUnitId);

  return (
    <Card className="border-brand/15 bg-brand-soft/35">
      <Link
        href="/study"
        className="-m-1 flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-brand-soft"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-brand" aria-hidden="true">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5V5.5A2.5 2.5 0 0 1 6.5 3H20v14H6.5A2.5 2.5 0 0 0 4 19.5Zm0 0A1.5 1.5 0 0 0 5.5 21H20" /></svg>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-ink">我的备考</span>
          <span className="block text-xs text-ink-muted mt-0.5 truncate">
            {target ? `${target.unitName} · 备考计划与材料` : "备考计划与材料"}
          </span>
        </span>
        <span className="text-ink-muted" aria-hidden="true">
          ›
        </span>
      </Link>
    </Card>
  );
}

function MyCorrectionsCard() {
  const [items, setItems] = useState<OpportunityCorrectionDTO[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    opportunitiesApi
      .listMyCorrections()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        // 无后端环境（如公开演示）不展示该卡片
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items === null || items.length === 0) return null;

  return (
    <details className="group rounded-2xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-semibold text-ink">我的纠错</span>
          <span className="mt-0.5 block text-xs text-ink-muted">{items.length} 条提交记录</span>
        </span>
        <span className="text-ink-muted transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="border-t border-line p-4">
        <ul className="space-y-3">
          {items.slice(0, 10).map((c) => (
            <li key={c.id} className="rounded-lg border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink truncate">
                  {c.unitName ?? "岗位已随旧版本移除"} · {c.fieldLabel}
                </p>
                <Badge variant={CORRECTION_STATUS_META[c.status].variant}>
                  {CORRECTION_STATUS_META[c.status].label}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-ink-muted line-clamp-2">{c.content}</p>
              {c.reviewNote && (
                <p className="mt-1.5 rounded bg-canvas px-2 py-1 text-xs text-ink-muted whitespace-pre-line">
                  处理说明：{c.reviewNote}
                </p>
              )}
              <p className="mt-1 text-[11px] text-ink-muted">
                提交于 {formatDateTime(c.createdAt)}
                {c.reviewedAt ? ` · 处理于 ${formatDateTime(c.reviewedAt)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
