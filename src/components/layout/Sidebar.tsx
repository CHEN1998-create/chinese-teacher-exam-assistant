"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { examTargetService } from "@/lib/services";
import { EDUCATION_LEVEL_LABELS } from "@/types";

const navItems = [
  { href: "/exam", label: "我的考试", icon: "📋" },
  { href: "/materials", label: "资料与资源", icon: "📚" },
  { href: "/plan", label: "本周计划", icon: "📅" },
  { href: "/today", label: "今天", icon: "✅" },
  { href: "/settings", label: "设置", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();
  const currentExam = examTargetService.getCurrent();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-slate-200">
      {/* Logo */}
      <div className="flex items-center h-16 px-6 border-b border-slate-200">
        <Link href="/exam" className="flex items-center gap-2">
          <span className="text-2xl">📝</span>
          <span className="text-lg font-semibold text-slate-900">考编助手</span>
        </Link>
      </div>

      {/* Current Exam Info */}
      {currentExam && (
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-600 font-medium mb-1">当前目标考试</p>
            <p className="text-sm font-medium text-slate-900 line-clamp-2">
              {currentExam.name}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {currentExam.region} · {EDUCATION_LEVEL_LABELS[currentExam.educationLevel]}
            </p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-200">
        <p className="text-xs text-slate-400 text-center">
          全国语文教师编备考助手
        </p>
      </div>
    </aside>
  );
}
