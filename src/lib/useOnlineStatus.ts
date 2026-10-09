"use client";

import { useSyncExternalStore } from "react";

/**
 * 网络在线状态监听（阶段六：完整状态覆盖）。
 *
 * 用途：当 navigator.onLine === false 时，页面可向用户明确提示「当前离线」，
 * 而不是把网络失败伪装成普通错误。SSR 首渲染默认 online，避免 hydration 不一致。
 */
function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    // 服务端快照恒为 online，客户端挂载后由事件同步真实状态
    () => true,
  );
}

/** 判断错误是否为鉴权失败（401/403）。api.ts 会把 res.status 挂到 Error 上。 */
export function isForbiddenError(e: unknown): boolean {
  const status = (e as Error & { status?: number })?.status;
  return status === 401 || status === 403;
}
