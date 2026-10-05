"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "@/lib/auth";
import { guestSessionService } from "@/lib/guest/guestSession";
import { LoadingPage } from "@/components/ui/Loading";

/**
 * 首页路由规则（v6.1）：
 * - 已登录 → 默认进入「机会」/opportunities（不做复杂智能路由；紧急报名事项
 *   在机会页顶部作为唯一优先行动展示）；
 * - 未登录且画像问答进行到一半 → 回到 /onboarding；
 * - 未登录且已看完初步结果 → /preview；
 * - 其余访客 → 价值首页（本页内容，无需登录）。
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
          <span className="text-3xl" aria-hidden="true">📝</span>
        </div>
        <h1 className="text-2xl font-bold leading-snug text-slate-900 md:text-3xl">
          填写地区、学历、专业、毕业状态和教师资格，
          <br />
          查看当前可能适合的教师公开招聘
        </h1>
        <p className="mt-3 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          当前先开放语文教师岗位
        </p>
        <p className="mt-4 text-sm text-slate-500 md:text-base">
          每个结论都给出公告依据：初步符合、补充信息后判断、建议人工确认、明确不符合，
          自己看得懂、能核对。
        </p>
        <Link
          href="/onboarding"
          className="mt-8 inline-flex h-12 w-full max-w-xs items-center justify-center rounded-xl bg-blue-600 px-8 text-base font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          看看我可能能报哪些
        </Link>
        <p className="mt-3 text-xs text-slate-400">无需登录，答案只保存在本机浏览器</p>
        <p className="mt-8 text-xs text-slate-400">
          已有账号？
          <Link href="/login" className="ml-1 text-blue-600 hover:underline">
            直接登录
          </Link>
        </p>
      </div>
    </div>
  );
}
