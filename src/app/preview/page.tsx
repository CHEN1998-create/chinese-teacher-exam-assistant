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
import { examTargetService, evidenceService, resourceService } from "@/lib/services";
import { LoadingPage } from "@/components/ui/Loading";

/**
 * 首次结果页（v5.1，v5.2 强化依据与资料入口）：
 * 未登录用户完成三步问答后，立即看到“今日第一步 + 7 天主题预览”。
 *
 * - supported：基于可查看来源的已核对信息给出针对这场考试的任务；
 * - unsupported：明确提示暂未支持，第一项是信息查找任务或标注“通用起步建议”的任务，
 *   绝不把通用内容包装为当地定制安排；
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
      return buildFirstResult(
        guest.answers,
        targets,
        evidence,
        resourceService.browseAll(),
        new Date().toISOString()
      );
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
      const migration = migrateGuestSessionToUser();
      if (!migration) {
        setError("保存失败：没有找到首次填写内容，请重新回答三个问题");
        setSaving(false);
        return;
      }
      // 计划已生成 → 今天；未生成 → 我的考试继续核对（已填信息保留，不落入空白页）
      router.push(migration.planReady ? "/today" : "/exam");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请稍后重试");
      setSaving(false);
    }
  };

  if (status === "loading") return <LoadingPage />;
  if (!result) return <LoadingPage />;

  const task = result.todayTask;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* 你准备的考试 */}
        <div className="text-center mb-6">
          <p className="text-xs text-slate-400 mb-1">你准备的考试</p>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">{result.examName}</h1>
          {result.supportStatus === "supported" ? (
            <Badge variant="success">已从官方公告核对 · 针对这场考试</Badge>
          ) : task.kind === "info_find" ? (
            <Badge variant="warning">考情还在核对</Badge>
          ) : (
            <Badge variant="muted">暂未支持针对这场考试的安排</Badge>
          )}
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">{result.supportNote}</p>
        </div>

        {/* 今天先做的一项任务 */}
        <Card className="mb-4">
          <p className="text-xs font-medium text-blue-600 mb-2">
            {task.generalAdvice ? "通用起步建议（不是当地定制安排）" : "今天先做这一项"}
          </p>
          <h2 className="text-lg font-bold text-slate-900">{task.title}</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            {task.material ? (
              <p>
                <span className="text-slate-400">用什么：</span>
                {task.material.url ? (
                  <a
                    href={task.material.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-blue-600 hover:underline"
                  >
                    {task.material.name}（点击打开）
                  </a>
                ) : (
                  task.material.name
                )}
              </p>
            ) : (
              <p className="text-amber-700">
                <span className="text-slate-400">用什么：</span>
                {task.kind === "info_find"
                  ? "无需资料，先查找官方公告"
                  : "暂无可打开的资料入口，这项任务暂不可执行"}
              </p>
            )}
            <p>
              <span className="text-slate-400">预计需要：</span>
              约 {task.estimatedMinutes} 分钟
            </p>
            <p>
              <span className="text-slate-400">做到什么算完成：</span>
              {task.completionCriteria}
            </p>
          </div>
          <details className="mt-3 group">
            <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
              为什么先做这件事？
            </summary>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{task.reason}</p>
          </details>
        </Card>

        {/* 待核对内容（未核实时重点展示） */}
        {result.supportStatus === "unsupported" && result.pendingChecks.length > 0 && (
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
            {saving
              ? "保存中..."
              : result.supportStatus === "supported"
                ? "保存接下来 7 天"
                : "保存已填信息，去核对考情"}
          </Button>
          <p className="text-center text-xs text-slate-400 mt-2">
            {result.supportStatus === "supported"
              ? status === "authenticated"
                ? "保存后进入「今天」，按计划开始执行"
                : "登录后可以保存安排和记录进度；不登录也可以继续查看本页"
              : "不会为未核对的考试生成 7 天计划；登录后先保存已填信息，核对考情后再生成安排"}
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
