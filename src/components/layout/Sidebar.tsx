"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { EDUCATION_LEVEL_LABELS, STAFF_ROLES, USER_ROLE_LABELS } from "@/types";
import { useCurrentUser } from "@/lib/auth";
import { useCurrentExamTarget } from "@/lib/targets/useCurrentExamTarget";
import { canGeneratePlan } from "@/lib/targets/domain";
import { Badge } from "@/components/ui/Badge";

const navItems = [
  { href: "/exam", label: "我的考试", icon: "📋" },
  { href: "/materials", label: "资料与资源", icon: "📚" },
  { href: "/plan", label: "本周计划", icon: "📅" },
  { href: "/today", label: "今天", icon: "✅" },
  { href: "/settings", label: "设置", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, role, hasRole, logout } = useCurrentUser();
  const currentExam = useCurrentExamTarget();

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
      <div className="px-4 py-3 border-b border-slate-200">
        {currentExam ? (
          <Link href="/exam" className="block bg-blue-50 hover:bg-blue-100/70 rounded-lg p-3 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-blue-600 font-medium">当前目标考试</p>
              {canGeneratePlan(currentExam) ? (
                <Badge variant="success">已确认</Badge>
              ) : (
                <Badge variant="warning">澄清中</Badge>
              )}
            </div>
            <p className="text-sm font-medium text-slate-900 line-clamp-2">
              {currentExam.name}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {[
                currentExam.region || "地区待确认",
                currentExam.educationLevel
                  ? EDUCATION_LEVEL_LABELS[currentExam.educationLevel]
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </Link>
        ) : (
          <Link href="/onboarding" className="block rounded-lg border border-dashed border-slate-300 p-3 hover:border-blue-400 transition-colors">
            <p className="text-xs text-slate-500 font-medium mb-0.5">尚未设置目标考试</p>
            <p className="text-sm font-medium text-blue-600">开始目标澄清 →</p>
          </Link>
        )}
      </div>

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

        {hasRole(STAFF_ROLES) && (
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              pathname.startsWith("/admin")
                ? "bg-slate-800 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <span className="text-lg">🛡️</span>
            运营后台
          </Link>
        )}
      </nav>

      {/* Current User */}
      <div className="px-3 py-3 border-t border-slate-200">
        {user && (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <span className="text-base">👤</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
              <p className="text-xs text-slate-500">
                {role ? USER_ROLE_LABELS[role] : ""}
              </p>
            </div>
            <button
              onClick={logout}
              title="退出登录"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
