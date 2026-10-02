"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  guestSessionService,
  TIME_CHOICES,
  PREPARE_STAGE_LABELS,
  GuestAnswers,
  PrepareStage,
} from "@/lib/guest/guestSession";
import { useCurrentUser } from "@/lib/auth";
import { examTargetService } from "@/lib/services";
import { migrateGuestSessionToUser } from "@/lib/guest/migrate";
import { EducationLevel } from "@/types";

const TOTAL_STEPS = 3;

/**
 * 三步快速问答（v5.1）：
 * 1. 你想考哪里？（选择示例 / 输入地区或招聘单位 / 粘贴公告链接）
 * 2. 你每天大约有多少时间？
 * 3. 你现在准备到哪一步？
 *
 * - 未登录也可完成，答案自动保存在本机浏览器（guestSessionService）；
 * - 支持返回修改，已填内容自动保留；
 * - 完成后进入首次结果页 /preview，保存安排时才需要登录。
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { status } = useCurrentUser();
  const isLoggedIn = status === "authenticated";

  // view: 0=引导，1-3=三个问题；guest session 的 step 表示“已完成到第几步”（3=全部完成）
  // 用惰性初始化从 localStorage 恢复，避免 effect 内 setState
  const [answers, setAnswers] = useState<GuestAnswers>(() => {
    if (typeof window === "undefined") return {};
    const guest = guestSessionService.load();
    return guest?.answers ?? {};
  });

  const [view, setView] = useState(() => {
    if (typeof window === "undefined") return 0;
    const guest = guestSessionService.load();
    if (guest && guest.step >= TOTAL_STEPS) return 0; // effect 会处理 replace
    return guest && guest.step > 0 ? Math.min(guest.step + 1, TOTAL_STEPS) : 0;
  });

  useEffect(() => {
    if (status === "loading") return;

    if (!isLoggedIn) {
      const guest = guestSessionService.load();
      if (guest && guest.step >= TOTAL_STEPS) {
        router.replace("/preview");
      }
    }
  }, [status, isLoggedIn, router]);

  // 已登录用户：回显当前目标的已有信息（渲染期合并，不覆盖已填内容）
  const effectiveAnswers: GuestAnswers = { ...answers };
  if (isLoggedIn && typeof window !== "undefined") {
    const current = examTargetService.getCurrent();
    if (current) {
      effectiveAnswers.province ??= current.province;
      effectiveAnswers.city ??= current.city ?? current.recruiter;
      effectiveAnswers.educationLevel ??= current.educationLevel;
    }
  }

  /** 完成第 n 步：合并答案并持久化（访客），进入下一问 */
  const advance = (finishedStep: number, patch: Partial<GuestAnswers>) => {
    const merged = { ...effectiveAnswers, ...patch };
    setAnswers(merged);
    guestSessionService.save({ answers: merged, step: finishedStep });
    setView(finishedStep + 1);
  };

  /** 第 3 步完成：保存全部答案并进入结果页 */
  const complete = (stage: PrepareStage) => {
    const merged = { ...effectiveAnswers, prepareStage: stage };
    setAnswers(merged);
    guestSessionService.save({ answers: merged, step: TOTAL_STEPS });
    if (isLoggedIn) {
      // 已登录用户：直接把问答结果落到自己的数据层（创建/确认目标并尝试生成首个安排）
      const result = migrateGuestSessionToUser();
      router.push(result ? "/today" : "/exam");
    } else {
      router.push("/preview");
    }
  };

  if (status === "loading") return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
            ← 返回首页
          </Link>
          <span className="text-xs text-slate-400">
            {view >= 1 && view <= TOTAL_STEPS ? `第 ${view} 步，共 ${TOTAL_STEPS} 步` : ""}
          </span>
        </div>

        {/* 进度条 */}
        <div className="flex gap-2 mb-6" aria-hidden="true">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < view ? "bg-blue-500" : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        {view === 0 && <StepIntro onStart={() => setView(1)} />}

        {view === 1 && (
          <Step1Region value={effectiveAnswers} onNext={(patch) => advance(1, patch)} />
        )}

        {view === 2 && (
          <Step2Time
            value={effectiveAnswers.dailyAvailableMinutes}
            onNext={(minutes) => advance(2, { dailyAvailableMinutes: minutes })}
          />
        )}

        {view === 3 && (
          <Step3Prepare value={effectiveAnswers.prepareStage} onComplete={complete} />
        )}

        {view > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setView((v) => Math.max(v - 1, 0))}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              返回上一步
            </button>
          </div>
        )}

        {!isLoggedIn && (
          <p className="text-center text-xs text-slate-400 mt-6">
            当前输入仅保存在本机浏览器，不会上传到服务器。
            <Link href="/login" className="text-blue-600 hover:underline ml-1">
              已有账号？直接登录
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

/* ================== 引导 ================== */
function StepIntro({ onStart }: { onStart: () => void }) {
  return (
    <Card className="text-center py-10">
      <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">📝</span>
      </div>
      <h1 className="text-xl font-bold text-slate-900 mb-2">
        三个问题，帮你找到今天的第一步
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        不需要上传资料、也不需要完成复杂设置。
        <br />
        填完就能看到今天最该做什么。
      </p>
      <Button onClick={onStart} size="lg" fullWidth>
        开始
      </Button>
    </Card>
  );
}

/* ================== 第 1 步：你想考哪里 ================== */
const DEMO_REGIONS: {
  province: string;
  city: string;
  educationLevel: EducationLevel;
  label: string;
}[] = [
  { province: "浙江省", city: "杭州市", educationLevel: "middle", label: "浙江 · 杭州 · 初中语文" },
  { province: "浙江省", city: "宁波市", educationLevel: "middle", label: "浙江 · 宁波 · 初中语文" },
  { province: "浙江省", city: "温州市", educationLevel: "middle", label: "浙江 · 温州 · 初中语文" },
  { province: "江苏省", city: "南京市", educationLevel: "high", label: "江苏 · 南京 · 高中语文" },
];

function Step1Region({
  value,
  onNext,
}: {
  value: GuestAnswers;
  onNext: (v: Partial<GuestAnswers>) => void;
}) {
  const [province, setProvince] = useState(value.province ?? "");
  const [city, setCity] = useState(value.city ?? value.recruiter ?? "");
  const [educationLevel, setEducationLevel] = useState<EducationLevel | "">(
    value.educationLevel ?? ""
  );
  const [mode, setMode] = useState<"choose" | "input" | "url">(
    value.announcementUrl ? "url" : value.province ? "input" : "choose"
  );
  const [url, setUrl] = useState(value.announcementUrl ?? "");

  const canNext = !!(province.trim() && city.trim()) || !!url.trim();

  const handleNext = () => {
    onNext({
      province: province.trim() || undefined,
      city: city.trim() || undefined,
      recruiter: undefined,
      educationLevel: (educationLevel || undefined) as EducationLevel | undefined,
      announcementUrl: url.trim() || undefined,
    });
  };

  const tabClass = (active: boolean) =>
    `text-sm px-3 py-1.5 rounded-lg border transition-colors ${
      active
        ? "border-blue-500 bg-blue-50 text-blue-700"
        : "border-slate-200 text-slate-600 hover:border-slate-300"
    }`;

  return (
    <Card>
      <h2 className="text-lg font-bold text-slate-900 mb-1">你想考哪里？</h2>
      <p className="text-sm text-slate-500 mb-5">
        选一个示例快速体验，或者自己填写；有公告链接也可以直接粘贴。
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button type="button" onClick={() => setMode("choose")} className={tabClass(mode === "choose")}>
          选择已有考试
        </button>
        <button type="button" onClick={() => setMode("input")} className={tabClass(mode === "input")}>
          输入地区或单位
        </button>
        <button type="button" onClick={() => setMode("url")} className={tabClass(mode === "url")}>
          粘贴公告链接
        </button>
      </div>

      {mode === "choose" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {DEMO_REGIONS.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => {
                setProvince(r.province);
                setCity(r.city);
                setEducationLevel(r.educationLevel);
              }}
              className={`text-left p-3 rounded-xl border transition-colors ${
                province === r.province && city === r.city
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-blue-300"
              }`}
            >
              <p className="text-sm font-medium text-slate-900">{r.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">示例数据，含已核对的考情</p>
            </button>
          ))}
        </div>
      )}

      {(mode === "input" || mode === "url") && (
        <div className="space-y-3 mb-5">
          {mode === "url" && (
            <input
              placeholder="粘贴公告链接（选填，例如当地教育局官网公告）"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="省份（如浙江省）"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              placeholder="城市或招聘单位（如杭州市）"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={educationLevel}
            onChange={(e) => setEducationLevel(e.target.value as EducationLevel)}
            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">选择学段（选填）</option>
            <option value="primary">小学</option>
            <option value="middle">初中</option>
            <option value="high">高中</option>
          </select>
        </div>
      )}

      <Button onClick={handleNext} disabled={!canNext} fullWidth>
        下一步
      </Button>
      {mode === "choose" && !province && (
        <p className="text-xs text-slate-400 text-center mt-2">点选一个示例，或切换到“自己填写”</p>
      )}
    </Card>
  );
}

/* ================== 第 2 步：每天可用时间 ================== */
function Step2Time({
  value,
  onNext,
}: {
  value?: number;
  onNext: (minutes: number) => void;
}) {
  const [selected, setSelected] = useState<number | undefined>(value);

  return (
    <Card>
      <h2 className="text-lg font-bold text-slate-900 mb-1">你每天大约有多少时间？</h2>
      <p className="text-sm text-slate-500 mb-5">
        选一个最接近你目前情况的范围即可，之后随时可以调整。
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {TIME_CHOICES.map((c) => (
          <button
            key={c.minutes}
            type="button"
            onClick={() => setSelected(c.minutes)}
            className={`p-4 rounded-xl border text-left transition-colors ${
              selected === c.minutes
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-blue-300"
            }`}
          >
            <p className="text-base font-medium text-slate-900">{c.label}</p>
          </button>
        ))}
      </div>
      <Button onClick={() => selected && onNext(selected)} disabled={!selected} fullWidth>
        下一步
      </Button>
    </Card>
  );
}

/* ================== 第 3 步：准备阶段 ================== */
function Step3Prepare({
  value,
  onComplete,
}: {
  value?: PrepareStage;
  onComplete: (stage: PrepareStage) => void;
}) {
  const [selected, setSelected] = useState<PrepareStage | undefined>(value);

  return (
    <Card>
      <h2 className="text-lg font-bold text-slate-900 mb-1">你现在准备到哪一步了？</h2>
      <p className="text-sm text-slate-500 mb-5">选最接近的一项，帮助安排今天的内容。</p>
      <div className="space-y-3 mb-5">
        {(Object.entries(PREPARE_STAGE_LABELS) as [PrepareStage, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelected(key)}
            className={`w-full text-left p-4 rounded-xl border transition-colors ${
              selected === key
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-blue-300"
            }`}
          >
            <p className="text-sm font-medium text-slate-900">{label}</p>
          </button>
        ))}
      </div>
      <Button onClick={() => selected && onComplete(selected)} disabled={!selected} fullWidth>
        查看我今天先做什么
      </Button>
    </Card>
  );
}
