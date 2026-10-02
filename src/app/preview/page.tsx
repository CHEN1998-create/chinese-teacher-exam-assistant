"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useCurrentUser } from "@/lib/auth";
import { guestSessionService } from "@/lib/guest/guestSession";
import { buildFirstResult, FirstResult } from "@/lib/guest/previewEngine";
import { migrateGuestSessionToUser } from "@/lib/guest/migrate";
import { examTargetService, evidenceService } from "@/lib/services";
import { LoadingPage } from "@/components/ui/Loading";

/**
 * 首次结果页（v5.1）：
 * 未登录用户完成三步问答后，立即看到“今日第一步 + 7 天主题预览”。
 *
 * - 考情已核对（匹配到 official 证据）：基于已核对信息给出今日任务与主题；
 * - 考情未核对：给出具体的信息查找任务，并列出哪些内容仍待核对，不编造科目或日期；
 * - 这只是轻量预览，不是经过资料分析的正式计划；
 * - 点击“保存接下来 7 天”才进入登录流程。
 */
export default function PreviewPage() {
  const router = useRouter();
  const { status } = useCurrentUser();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // 初始化时直接计算结果（避免 effect 内 setState）
  const [result] = useState<FirstResult | null>(() => {
    if (typeof window === "undefined") return null;
    const guest = guestSessionService.load();
    if (guest && guest.step >= 3) {
      const targets = examTargetService.getAllRaw();
      const evidence = targets.flatMap((t) => evidenceService.getItems(t.id));
      return buildFirstResult(guest.answers, targets, evidence);
    }
    return null;
  });

  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated") {
      // 已登录但直接访问 /preview：回到“今天”
      router.replace("/today");
      return;
    }

    // 未登录且无访客进度：回到问答
    if (!result) {
      router.replace("/onboarding");
    }
  }, [status, router, result]);

  const handleSave = () => {
    setError(null);
    setSaving(true);
    try {
      if (status !== "authenticated") {
        // 保存安排时才登录；登录成功后回到本页自动完成保存
        router.push("/login?next=/preview");
        return;
      }
      const migrated = migrateGuestSessionToUser();
      if (migrated) {
        router.push("/today");
      } else {
        router.push("/today");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请稍后重试");
      setSaving(false);
    }
  };

  if (status === "loading") return <LoadingPage />;
  if (!result) return <LoadingPage />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* 你准备的考试 */}
        <div className="text-center mb-6">
          <p className="text-xs text-slate-400 mb-1">你准备的考试</p>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">{result.examName}</h1>
          {result.verified ? (
            <Badge variant="success">已从官方公告核对</Badge>
          ) : (
            <Badge variant="warning">考情待核对</Badge>
          )}
        </div>

        {/* 今天先做的一项任务 */}
        <Card className="mb-4">
          <p className="text-xs font-medium text-blue-600 mb-2">今天先做这一项</p>
          <h2 className="text-lg font-bold text-slate-900">{result.todayTask.title}</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p>
              <span className="text-slate-400">预计需要：</span>
              约 {result.todayTask.estimatedMinutes} 分钟
            </p>
            <p>
              <span className="text-slate-400">做到什么算完成：</span>
              {result.todayTask.completionCriteria}
            </p>
            <p>
              <span className="text-slate-400">为什么先做这件事：</span>
              {result.todayTask.reason}
            </p>
          </div>
        </Card>

        {/* 待核对内容（未核实时重点展示） */}
        {!result.verified && result.pendingChecks.length > 0 && (
          <Card className="mb-4 bg-amber-50/60">
            <p className="text-sm font-medium text-amber-800 mb-2">这些内容还需要核对</p>
            <ul className="text-sm text-amber-700 space-y-1">
              {result.pendingChecks.map((c) => (
                <li key={c}>· {c}</li>
              ))}
            </ul>
            <p className="text-xs text-amber-600 mt-2">
              核对后保存安排，后面的 7 天内容会按真实考情生成，不会凭空编造。
            </p>
          </Card>
        )}

        {/* 已核对的关键信息 */}
        {result.confirmedFacts.length > 0 && (
          <Card className="mb-4">
            <p className="text-sm font-medium text-slate-900 mb-2">这次考试怎么考（已从官方公告核对）</p>
            <dl className="space-y-2">
              {result.confirmedFacts.map((f) => (
                <div key={f.label} className="flex gap-2 text-sm">
                  <dt className="shrink-0 text-slate-400 w-16">{f.label}</dt>
                  <dd className="text-slate-700">{f.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}

        {/* 保存按钮：只有这里才需要登录 */}
        <div className="my-6">
          <Button onClick={handleSave} size="lg" fullWidth disabled={saving}>
            {saving ? "保存中..." : "保存接下来 7 天"}
          </Button>
          <p className="text-center text-xs text-slate-400 mt-2">
            {status === "authenticated"
              ? "保存后进入「今天」，按计划开始执行"
              : "登录后可以保存安排和记录进度；不登录也可以继续查看本页"}
          </p>
          {error && (
            <p role="alert" className="text-center text-sm text-red-600 mt-2">
              {error}
            </p>
          )}
        </div>

        {/* 七天主题 / 来源（按需展开） */}
        <Card>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-sm font-medium text-slate-900">
              7 天主题预览{result.sources.length > 0 ? "与考情来源" : ""}
            </span>
            <span className="text-xs text-slate-400">{showDetails ? "收起" : "展开"}</span>
          </button>
          {showDetails && (
            <div className="mt-3 space-y-4">
              <ol className="space-y-1.5">
                {result.weekThemes.map((t) => (
                  <li key={t} className="text-sm text-slate-600">
                    {t}
                  </li>
                ))}
              </ol>
              {result.sources.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">考情来源</p>
                  <ul className="space-y-1">
                    {result.sources.map((s) => (
                      <li key={s.name} className="text-xs text-slate-500">
                        {s.url ? (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-blue-600 hover:underline"
                          >
                            {s.name}
                          </a>
                        ) : (
                          s.name
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-slate-400 leading-relaxed">
                说明：以上是首次体验的轻量预览，不是经过资料分析的正式计划。保存后可在「我的考试」补充资料，
                由正式计划引擎生成更精确的 7 天安排。
              </p>
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">
          <Link href="/onboarding" className="text-blue-600 hover:underline">
            返回修改答案
          </Link>
        </p>
      </div>
    </div>
  );
}
