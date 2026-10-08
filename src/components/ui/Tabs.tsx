"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface TabsProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onChange: (id: string) => void;
  children: ReactNode;
}

export function Tabs({ tabs, activeTab, onChange, children }: TabsProps) {
  return (
    <div>
      <div
        className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1"
        role="tablist"
        aria-label="页面分区"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "min-h-10 flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              activeTab === tab.id
                ? "bg-brand-soft text-brand"
                : "text-ink-muted hover:bg-canvas hover:text-ink"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}

interface TabPanelProps {
  id: string;
  activeTab: string;
  children: ReactNode;
}

export function TabPanel({ id, activeTab, children }: TabPanelProps) {
  if (id !== activeTab) return null;
  return <div role="tabpanel">{children}</div>;
}
