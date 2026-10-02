"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "@/lib/auth";
import { guestSessionService } from "@/lib/guest/guestSession";
import { examTargetService, planService } from "@/lib/services";
import { LoadingPage } from "@/components/ui/Loading";

/**
 * 首页路由规则（v5.1）：
 * - 未登录且没有体验进度 → 价值首页（本页内容）；
 * - 未登录但体验到一半 → 回到上次未完成的问题（/onboarding）；
 * - 未登录且已看完首次结果 → /preview；
 * - 已登录但没有安排 → 快速问答（/onboarding）；
 * - 已登录且有执行中的安排 → 默认进入“今天”（/today）。
 */
export default function Home() {
  const router = useRouter();
  const { status } = useCurrentUser();

  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated") {
      const target = examTargetService.getCurrent();
      const plan = planService.getCurrentPlan();
      if (target && plan?.status === "active") {
        router.replace("/today");
      } else if (!target) {
        router.replace("/onboarding");
      } else {
        // 有目标但还没有执行中的安排：仍进入“今天”，由该页引导下一步
        router.replace("/today");
      }
      return;
    }

    // 未登录
    if (guestSessionService.isInProgress()) {
      router.replace("/onboarding");
      return;
    }
    if (guestSessionService.isComplete()) {
      router.replace("/preview");
      return;
    }
    // landing：无需任何操作，直接渲染首页
  }, [status, router]);

  if (status === "loading") return <LoadingPage />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">📝</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-snug">
          告诉我你想考哪里、每天有多少时间，
          <br />
          我先帮你安排今天做什么
        </h1>
        <p className="text-slate-500 mt-4 text-sm md:text-base">
          三个问题，一分钟，就能看到今天的第一步。
        </p>
        <Link
          href="/onboarding"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-8 text-base font-medium text-white hover:bg-blue-700 transition-colors"
        >
          看看我今天先做什么
        </Link>
        <p className="mt-3 text-xs text-slate-400">无需登录，答案只保存在本机浏览器</p>
        <p className="mt-8 text-xs text-slate-400">
          已有账号？
          <Link href="/login" className="text-blue-600 hover:underline ml-1">
            直接登录
          </Link>
        </p>
      </div>
    </div>
  );
}
