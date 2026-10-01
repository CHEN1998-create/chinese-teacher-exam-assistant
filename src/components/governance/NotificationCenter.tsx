"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useNotifications } from "@/lib/governance/useGovernance";
import { notificationService } from "@/lib/governance/notificationService";
import { NotificationItem } from "@/types";
import { NOTIFICATION_TYPE_META } from "./badges";
import { formatDateTime } from "@/lib/utils";

/**
 * 站内通知中心（铃铛 + 下拉面板）。
 * Mock 边界：当前只有站内通知，没有短信/邮件/推送通道；
 * 「模拟今日学习提醒」按钮用于演示每日最多一条的频控规则。
 */
export function NotificationCenter() {
  const { items, unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const [reminderHint, setReminderHint] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, rootRef]);

  const simulateReminder = () => {
    const result = notificationService.ensureStudyReminder();
    setReminderHint(
      result.outcome === "created"
        ? "已生成今日学习提醒"
        : result.outcome === "already_exists"
          ? "今天已经发送过学习提醒（每天最多一条）"
          : "学习提醒当前被你的通知设置关闭"
    );
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={`通知中心，未读 ${unreadCount} 条`}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      >
        <span className="text-lg leading-none">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-slate-900">通知</p>
            <button
              type="button"
              onClick={() => notificationService.markAllRead()}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              全部已读
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                暂无通知。没有重要考情变化时不会发送提醒。
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.slice(0, 20).map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    onOpen={() => setOpen(false)}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-slate-100 px-4 py-2.5 space-y-1">
            {reminderHint && (
              <p className="text-[11px] text-slate-400">{reminderHint}</p>
            )}
            <button
              type="button"
              onClick={simulateReminder}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              模拟今日学习提醒（Mock）
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({ item, onOpen }: { item: NotificationItem; onOpen: () => void }) {
  const meta = NOTIFICATION_TYPE_META[item.type];
  const unread = !item.readAt;
  const href = item.related?.href ?? "/";

  return (
    <li>
      <Link
        href={href}
        onClick={() => {
          notificationService.markRead(item.id);
          onOpen();
        }}
        className={`flex gap-3 px-4 py-3 hover:bg-slate-50 ${unread ? "bg-blue-50/40" : ""}`}
      >
        <span className="mt-0.5 text-base leading-none">{meta.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
            {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
          </div>
          <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-slate-500">
            {item.body}
          </p>
          {item.nextSteps && item.nextSteps.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-[11px] text-slate-500">
              {item.nextSteps.slice(0, 3).map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(item.createdAt)}</p>
        </div>
      </Link>
    </li>
  );
}
