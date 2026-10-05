/**
 * 机会发现模块 API 客户端（模块 5）。
 *
 * 浏览器只调用同源 /api/opportunities/*（由 Next 路由代理到后端），
 * 身份头从本地会话注入；判定逻辑全部在后端，这里只负责收发与错误归一。
 */
import { authService } from "@/lib/auth";
import type { UserRecruitmentProfile } from "@/lib/profile/types";
import type {
  FollowDTO,
  FollowStatus,
  MatchResponse,
  StudyTargetRole,
  UnitDetailResponse,
} from "./api-types";

const API_BASE = "/api/opportunities";

function authHeaders(): Record<string, string> {
  const session = authService.getSession();
  // 仅传后端 UserGuard 需要的 x-user-id。
  // 不放 x-user-name：中文名超出 fetch 请求头允许的 ISO-8859-1 范围会直接抛错，
  // 展示名也不应经由请求头上行。
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
  /** 机会列表（按当前画像即时计算，四档分组 + 关注状态 + 版本信息） */
  match(profile: UserRecruitmentProfile): Promise<MatchResponse> {
    return request<MatchResponse>("/match", {
      method: "POST",
      body: JSON.stringify({ profile }),
    });
  },

  /** 机会详情（三层结构所需的逐条件、证据、版本链数据） */
  unitDetail(
    unitId: string,
    profile: UserRecruitmentProfile,
  ): Promise<UnitDetailResponse> {
    return request<UnitDetailResponse>(`/units/${encodeURIComponent(unitId)}/detail`, {
      method: "POST",
      body: JSON.stringify({ profile }),
    });
  },

  listFollows(): Promise<FollowDTO[]> {
    return request<FollowDTO[]>("/follows");
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
