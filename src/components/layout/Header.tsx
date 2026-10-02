"use client";

import { usePathname } from "next/navigation";
import { EDUCATION_LEVEL_LABELS } from "@/types";
import { useCurrentExamTarget } from "@/lib/targets/useCurrentExamTarget";
import { NotificationCenter } from "@/components/governance/NotificationCenter";
import { useCurrentUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo/config";

const pageTitles: Record<string, string> = {
  "/onboarding": "快速问答",
  "/exam": "我的考试",
  "/materials": "我的资料",
  "/plan": "接下来 7 天",
  "/today": "今天",
  "/settings": "设置",
};

export function Header() {
  const pathname = usePathname();
  const { status } = useCurrentUser();
  const currentExam = useCurrentExamTarget();
  const title = pageTitles[pathname] || "考编助手";

  // 会话恢复完成前不渲染依赖存储的摘要与通知，保证与服务端渲染一致
  const ready = status === "authenticated";

  const summary = currentExam
    ? [
        currentExam.region || "地区待确认",
        currentExam.educationLevel
          ? EDUCATION_LEVEL_LABELS[currentExam.educationLevel]
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <header
      className={`md:hidden sticky z-40 bg-white border-b border-slate-200 ${
        // 演示模式：移动端为两行高的横幅让出空间
        isDemoMode ? "top-11" : "top-0"
      }`}
    >
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3">
          {pathname !== "/onboarding" && (
            <button
              onClick={() => window.history.back()}
              className="p-1 -ml-1 text-slate-600 hover:text-slate-900"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {ready && summary && pathname !== "/onboarding" && (
            <span className="truncate max-w-[140px] text-xs text-slate-500">{summary}</span>
          )}
          {ready && <NotificationCenter />}
        </div>
      </div>
    </header>
  );
}
