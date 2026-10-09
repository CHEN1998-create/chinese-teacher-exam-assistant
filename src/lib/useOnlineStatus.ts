"use client";

import { useEffect, useState } from "react";

/**
 * 网络在线状态监听（阶段六：完整状态覆盖）。
 *
 * 用途：当 navigator.onLine === false 时，页面可向用户明确提示「当前离线」，
 * 而不是把网络失败伪装成普通错误。SSR 首渲染默认 online，避免 hydration 不一致。
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}

/** 判断错误是否为鉴权失败（401/403）。api.ts 会把 res.status 挂到 Error 上。 */
export function isForbiddenError(e: unknown): boolean {
  const status = (e as Error & { status?: number })?.status;
  return status === 401 || status === 403;
}
