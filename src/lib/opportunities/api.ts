/**
 * 机会发现模块 API 客户端（模块 5）。
 *
 * 浏览器只调用同源 /api/opportunities/*（由 Next 路由代理到后端），
 * 身份头从本地会话注入；判定逻辑全部在后端，这里只负责收发与错误归一。
 */
import { authService, AUTH_MODE } from "@/lib/auth";
import type { UserRecruitmentProfile } from "@/lib/profile/types";
import type {
  FollowDTO,
  FollowStatus,
  GoalsResponse,
  MatchResponse,
  StudyTargetRole,
  UnitDetailResponse,
} from "./api-types";

const API_BASE = "/api/opportunities";

function authHeaders(): Record<string, string> {
  // invited 模式：身份由 HttpOnly 会话 cookie 承载，绝不发送客户端可伪造的 x-user-id；
  // demo 模式：保持现有 x-user-id 头链路。
  if (AUTH_MODE === "invited") return {};
  const session = authService.getSession();
  if (!session) return {};
  return {
    "x-user-id": session.userId,
  };
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

export const opportunitiesApi = {
  /** 机会列表（按当前画像即时计算，四档分组 + 关注状态 + 版本信息）。
   *  invited 模式下不发送画像，由后端读取已持久化的画像（跨浏览器一致）。 */
  match(profile: UserRecruitmentProfile): Promise<MatchResponse> {
    return request<MatchResponse>("/match", {
      method: "POST",
      body: AUTH_MODE === "invited" ? JSON.stringify({}) : JSON.stringify({ profile }),
    });
  },

  /** 机会详情（三层结构所需的逐条件、证据、版本链数据）。
   *  invited 模式下不发送画像，由后端读取已持久化的画像。 */
  unitDetail(
    unitId: string,
    profile: UserRecruitmentProfile,
  ): Promise<UnitDetailResponse> {
    return request<UnitDetailResponse>(`/units/${encodeURIComponent(unitId)}/detail`, {
      method: "POST",
      body: AUTH_MODE === "invited" ? JSON.stringify({}) : JSON.stringify({ profile }),
    });
  },

  listFollows(): Promise<FollowDTO[]> {
    return request<FollowDTO[]>("/follows");
  },

  /** 备考目标列表（模块 7）：活跃关注 + 公告版本聚合 */
  getGoals(): Promise<GoalsResponse> {
    return request<GoalsResponse>("/goals");
  },

  /** 关注：后端保证初始状态为 considering（收藏 ≠ 准备报名），重复关注幂等 */
  follow(unitId: string): Promise<FollowDTO> {
    return request<FollowDTO>(
      `/units/${encodeURIComponent(unitId)}/follow`,
      { method: "POST" },
    );
  },

  transition(
    unitId: string,
    status: FollowStatus,
    options?: { note?: string; abandonReason?: string },
  ): Promise<FollowDTO> {
    return request<FollowDTO>(
      `/units/${encodeURIComponent(unitId)}/follow`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status,
          note: options?.note,
          abandonReason: options?.abandonReason,
        }),
      },
    );
  },

  unfollow(unitId: string): Promise<{ ok: true }> {
    return request<{ ok: true }>(
      `/units/${encodeURIComponent(unitId)}/follow`,
      { method: "DELETE" },
    );
  },

  setRole(unitId: string, role: StudyTargetRole): Promise<FollowDTO> {
    return request<FollowDTO>(
      `/units/${encodeURIComponent(unitId)}/role`,
      { method: "PUT", body: JSON.stringify({ role }) },
    );
  },

  /** 开启/关闭单个机会的站内提醒（日程仍可见，只控制通知生成） */
  setRemindersMuted(unitId: string, muted: boolean): Promise<FollowDTO> {
    return request<FollowDTO>(
      `/units/${encodeURIComponent(unitId)}/reminders`,
      { method: "PATCH", body: JSON.stringify({ muted }) },
    );
  },

  submitCorrection(
    unitId: string,
    input: { fieldPath: string; content: string; contact?: string },
  ): Promise<{ id: string; status: string }> {
    return request<{ id: string; status: string }>(
      `/units/${encodeURIComponent(unitId)}/corrections`,
      { method: "POST", body: JSON.stringify(input) },
    );
  },
};
