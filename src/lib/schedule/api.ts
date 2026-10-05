/**
 * 报名日程与站内提醒 API 客户端（模块 6）。
 * 浏览器只调同源 /api/schedule/*；demo 模式身份头传 x-user-id + x-user-role
 * （后端两者缺一即 401，见 backend userFromHeaders），invited 模式不发送身份头。
 */
import { AUTH_MODE, authService } from "@/lib/auth";
import type {
  NotificationDTO,
  ScheduleResponse,
} from "./types";

const API_BASE = "/api/schedule";

function authHeaders(): Record<string, string> {
  // invited 模式：身份由 HttpOnly 会话 cookie 承载，绝不发送客户端可伪造的 x-user-*；
  // demo 模式：发送 x-user-id + x-user-role（后端两者缺一即 401，见 backend userFromHeaders）。
  if (AUTH_MODE === "invited") return {};
  const session = authService.getSession();
  if (!session) return {};
  return { "x-user-id": session.userId, "x-user-role": session.role };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message || body.error || `请求失败 (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const scheduleApi = {
  /** 日程：先同步最新公告版本再返回该用户关注机会的全部时间线事件 */
  getSchedule(): Promise<ScheduleResponse> {
    return request<ScheduleResponse>("");
  },

  /** 站内通知列表（按创建时间倒序，最多 50 条） */
  getNotifications(): Promise<NotificationDTO[]> {
    return request<NotificationDTO[]>("/notifications");
  },

  /** 标记单条通知已读 */
  markNotificationRead(id: string): Promise<void> {
    return request<void>(`/notifications/${encodeURIComponent(id)}/read`, {
      method: "PATCH",
    });
  },

  /** 全部标为已读 */
  markAllRead(): Promise<void> {
    return request<void>("/notifications/read-all", { method: "PATCH" });
  },
};
