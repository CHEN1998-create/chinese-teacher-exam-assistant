"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { DemoBanner, DEMO_BANNER_SPACER_CLASS } from "@/components/demo/DemoBanner";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // 登录页：完全独立，无导航、无守卫
  if (pathname === "/login") {
    return (
      <>
        <DemoBanner />
        <div className={DEMO_BANNER_SPACER_CLASS} />
        {children}
      </>
    );
  }

  // 运营后台：不使用用户端导航，守卫与后台框架由 /admin 布局负责
  if (pathname.startsWith("/admin")) {
    return (
      <>
        <DemoBanner />
        {children}
      </>
    );
  }

  // 目标澄清页：无导航外壳，但仍需登录
  if (pathname === "/onboarding") {
    return (
      <div className="min-h-screen bg-slate-50">
        <DemoBanner />
        <div className={DEMO_BANNER_SPACER_CLASS} />
        <RequireAuth>{children}</RequireAuth>
      </div>
    );
  }

  // 用户端常规页面
  return (
    <div className="min-h-screen bg-slate-50">
      <DemoBanner />
      <Sidebar />
      <Header />
      <main className="md:pl-64 pb-16 md:pb-0">
        <div className={DEMO_BANNER_SPACER_CLASS} />
        <div className="max-w-4xl mx-auto px-4 py-6 md:px-8">
          <RequireAuth>{children}</RequireAuth>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
