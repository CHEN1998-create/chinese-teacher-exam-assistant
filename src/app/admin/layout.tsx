"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RequireRole } from "@/components/auth/RequireAuth";
import { useCurrentUser } from "@/lib/auth";
import { STAFF_ROLES, USER_ROLE_LABELS } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { href: "/admin", label: "后台概览", exact: true },
  { href: "/admin/exams", label: "考情管理", exact: false },
  { href: "/admin/reviews", label: "审核队列", exact: false },
  { href: "/admin/resources", label: "资源管理", exact: false },
];

function AdminChrome({ children }: { children: React.ReactNode }) {
  const { user, role, logout } = useCurrentUser();
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 后台顶栏 */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg">🛡️</span>
            <div>
              <p className="text-sm font-semibold leading-4">运营审核后台</p>
              <p className="text-[11px] text-slate-400">全国语文教师编备考助手</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm leading-4">{user?.name}</p>
              {role && (
                <Badge variant="info" className="mt-0.5">
                  {USER_ROLE_LABELS[role]}
                </Badge>
              )}
            </div>
            <Link
              href="/exam"
              className="text-xs text-slate-300 hover:text-white transition-colors"
            >
              返回用户端
            </Link>
            <button
              onClick={logout}
              className="text-xs text-slate-300 hover:text-white transition-colors"
            >
              退出登录
            </button>
          </div>
        </div>
        {/* 后台子导航 */}
        <nav className="bg-slate-800">
          <div className="max-w-6xl mx-auto px-4 flex gap-1">
            {ADMIN_NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-4 py-2.5 text-sm transition-colors border-b-2",
                    active
                      ? "text-white border-white font-medium"
                      : "text-slate-400 border-transparent hover:text-slate-200"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={STAFF_ROLES}>
      <AdminChrome>{children}</AdminChrome>
    </RequireRole>
  );
}
