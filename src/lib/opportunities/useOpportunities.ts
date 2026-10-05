"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildActiveProfile,
  type ActiveProfileReason,
} from "@/lib/profile/activeProfile";
import type { UserRecruitmentProfile } from "@/lib/profile/types";
import { opportunitiesApi } from "./api";
import type {
  FollowStatus,
  MatchResponse,
  StudyTargetRole,
  UnitMatchDTO,
} from "./api-types";

export type OpportunitiesLoadState =
  | { status: "loading" }
  | { status: "no-profile"; reason: ActiveProfileReason }
  | {
      status: "ready";
      data: MatchResponse;
      profile: UserRecruitmentProfile;
    }
  | { status: "error"; error: string };

export interface OpportunitiesApi {
  state: OpportunitiesLoadState;
  reload: () => Promise<void>;
  followBusyId: string | null;
  actionError: string | null;
  toggleFollow: (unit: UnitMatchDTO) => Promise<void>;
}

function computeInitialState():
  | { status: "loading" }
  | { status: "no-profile"; reason: ActiveProfileReason } {
  const active = buildActiveProfile();
  return active.ready
    ? { status: "loading" }
    : { status: "no-profile", reason: active.reason };
}

/**
 * 机会列表数据：登录后只读后端匹配结果（按请求即时计算）。
 * 画像来自本机基础画像草稿 + 补充事实；画像变化后调用 reload 即得新结果。
 * 动作失败不破坏已有数据，通过 actionError 提示。
 */
export function useOpportunities(): OpportunitiesApi {
  const [state, setState] = useState<OpportunitiesLoadState>(computeInitialState);
  const [followBusyId, setFollowBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = useCallback(async (silent = false) => {
    if (!silent) setState({ status: "loading" });
    const active = buildActiveProfile();
    if (!active.ready) {
      setState({ status: "no-profile", reason: active.reason });
      return;
    }
    try {
      const data = await opportunitiesApi.match(active.profile);
      setState({ status: "ready", data, profile: active.profile });
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "机会加载失败",
      });
    }
  }, []);

  // 初次加载：仅在画像 ready 时发起请求；setState 均在异步回调中
  useEffect(() => {
    const active = buildActiveProfile();
    if (!active.ready) return;
    let cancelled = false;
    opportunitiesApi
      .match(active.profile)
      .then((data) => {
        if (!cancelled) {
          setState({ status: "ready", data, profile: active.profile });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            status: "error",
            error: error instanceof Error ? error.message : "机会加载失败",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFollow = useCallback(
    async (unit: UnitMatchDTO) => {
      setFollowBusyId(unit.unit.id);
      setActionError(null);
      try {
        if (unit.follow) {
          await opportunitiesApi.unfollow(unit.unit.id);
        } else {
          await opportunitiesApi.follow(unit.unit.id);
        }
        await reload(true);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "操作失败");
      } finally {
        setFollowBusyId(null);
      }
    },
    [reload],
  );

  return {
    state,
    reload: () => reload(false),
    followBusyId,
    actionError,
    toggleFollow,
  };
}

export type ActiveProfileLoadState =
  | { status: "no-profile"; reason: ActiveProfileReason }
  | { status: "ready"; profile: UserRecruitmentProfile };

/** 供详情页复用的画像读取（本地数据，惰性计算，无副作用） */
export function useActiveProfile(): ActiveProfileLoadState {
  const [state] = useState<ActiveProfileLoadState>(() => {
    const active = buildActiveProfile();
    return active.ready
      ? { status: "ready", profile: active.profile }
      : { status: "no-profile", reason: active.reason };
  });
  return state;
}

export type { FollowStatus, StudyTargetRole };
