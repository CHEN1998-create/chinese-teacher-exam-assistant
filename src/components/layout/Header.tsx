"use client";

import { usePathname } from "next/navigation";
import { examTargetService } from "@/lib/services";
import { EDUCATION_LEVEL_LABELS } from "@/types";

const pageTitles: Record<string, string> = {
  "/onboarding": "目标澄清",
  "/exam": "我的考试",
  "/materials": "资料与资源",
  "/plan": "本周计划",
  "/today": "今天与复盘",
  "/settings": "设置与数据",
};

export function Header() {
  const pathname = usePathname();
  const currentExam = examTargetService.getCurrent();
  const title = pageTitles[pathname] || "考编助手";

  return (
    <header className="md:hidden sticky top-0 z-40 bg-white border-b border-slate-200">
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
        {currentExam && pathname !== "/onboarding" && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="truncate max-w-[120px]">{currentExam.region}</span>
            <span>{EDUCATION_LEVEL_LABELS[currentExam.educationLevel]}</span>
          </div>
        )}
      </div>
    </header>
  );
}
