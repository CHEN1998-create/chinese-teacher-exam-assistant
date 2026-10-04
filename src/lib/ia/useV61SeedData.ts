"use client";

/**
 * v6.1 三主页的只读数据入口（模块 3 骨架）。
 *
 * 本轮无匹配后端：数据来自 lib/seed 的分域演示 seed。
 * 通过异步加载显式覆盖 加载中 / 成功 / 失败（可重试）三种界面；
 * 空数据与权限不足由页面与 RequireAuth 分别处理。
 * 模块 5 接入真实 API 时只替换 loader，页面状态分支不变。
 */
import { useCallback, useEffect, useState } from "react";

export interface SeedDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useV61SeedData<T>(loader: () => T): SeedDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // error 初始为 null，重试时由 reload 显式清空；
    // 微任务异步化：让“加载中”状态真实出现，便于未来无缝替换为网络请求
    Promise.resolve()
      .then(loader)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "暂时加载失败，请稍后重试");
        }
      });
    return () => {
      cancelled = true;
    };
    // loader 为模块级纯函数，不放入依赖；attempt 驱动显式重试
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const reload = useCallback(() => {
    setError(null);
    setData(null);
    setAttempt((n) => n + 1);
  }, []);

  return { data, loading: data === null && error === null, error, reload };
}
