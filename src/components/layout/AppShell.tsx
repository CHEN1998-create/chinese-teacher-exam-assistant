"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isOnboarding = pathname === "/onboarding";

  if (isOnboarding) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <Header />
      <main className="md:pl-64 pb-16 md:pb-0">
        <div className="max-w-4xl mx-auto px-4 py-6 md:px-8">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
