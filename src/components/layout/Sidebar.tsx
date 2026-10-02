"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { EDUCATION_LEVEL_LABELS, STAFF_ROLES, USER_ROLE_LABELS } from "@/types";
import { useCurrentUser } from "@/lib/auth";
import { useCurrentExamTarget } from "@/lib/targets/useCurrentExamTarget";
import { canGeneratePlan } from "@/lib/targets/domain";
import { Badge } from "@/components/ui/Badge";
import { NotificationCenter } from "@/components/governance/NotificationCenter";
import { isDemoMode } from "@/lib/demo/config";

// v5.1：主导航只保留三个入口；资料判断与资源推荐在任务或「我的考试」中按需出现
const navItems = [
  { href: "/today", label: "今天", icon: "✅" },
  { href: "/plan", label: "接下来 7 天", icon: "📅" },
  { href: "/exam", label: "我的考试", icon: "📋" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, role, hasRole, logout, status } = useCurrentUser();
  const currentExam = useCurrentExamTarget();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击菜单外部时收起头像菜单
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  // 会话恢复完成前只渲染与服务端一致的静态骨架，
  // 避免硬刷新时“服务端无会话 / 客户端 localStorage 有会话”造成水合不匹配
  const ready = status === "authenticated";

  return (
    <aside
      className={cn(
        "hidden md:flex md:w-64 md:flex-col md:fixed bg-white border-r border-slate-200",
        // 演示模式：为顶部固定横幅让出空间
        isDemoMode ? "md:top-8 md:h-[calc(100%-2rem)]" : "md:inset-y-0"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-6 border-b border-slate-200">
        <Link href="/today" className="flex items-center gap-2">
          <span className="text-2xl">📝</span>
          <span className="text-lg font-semibold text-slate-900">考编助手</span>
        </Link>
      </div>

      {/* 你准备的考试 */}
      <div className="px-4 py-3 border-b border-slate-200">
        {!ready ? (
          // 加载占位（服务端与客户端首次渲染一致）
          <div className="h-[86px] rounded-lg bg-slate-50 animate-pulse" aria-hidden="true" />
        ) : currentExam ? (
          <Link href="/exam" className="block bg-blue-50 hover:bg-blue-100/70 rounded-lg p-3 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-blue-600 font-medium">你准备的考试</p>
              {canGeneratePlan(currentExam) ? (
                <Badge variant="success">已确认</Badge>
              ) : (
                <Badge variant="warning">待确认</Badge>
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
            <p className="text-xs text-slate-500 font-medium mb-0.5">还没说要考哪里</p>
            <p className="text-sm font-medium text-blue-600">开始快速问答 →</p>
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

        {ready && hasRole(STAFF_ROLES) && !isDemoMode && (
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

      {/* 头像菜单：设置与退出登录 */}
      <div className="px-3 py-3 border-t border-slate-200 relative" ref={menuRef}>
        {!ready ? (
          <div className="h-[52px] rounded-lg bg-slate-50 animate-pulse" aria-hidden="true" />
        ) : (
          user && (
            <>
              {menuOpen && (
                <div className="absolute bottom-full left-3 right-3 mb-2 rounded-xl border border-slate-200 bg-white shadow-lg py-1 z-50">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
                    <p className="text-xs text-slate-500">
                      {role ? USER_ROLE_LABELS[role] : ""}
                    </p>
                  </div>
                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <span>⚙️</span> 设置
                  </Link>
                  <Link
                    href="/materials"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <span>📚</span> 我的资料
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left"
                  >
                    <span>🚪</span> 退出登录
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex-1 flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors text-left"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <span className="text-base">👤</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
                  </div>
                  <svg
                    className={cn("w-4 h-4 text-slate-400 transition-transform", menuOpen && "rotate-180")}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <NotificationCenter />
              </div>
            </>
          )
        )}
      </div>
    </aside>
  );
}
