/**
 * v6.1 用户端主导航（模块 3：机会 / 日程 / 备考）。
 *
 * 不变量（docs/v6.1-information-architecture.md 第 1 节）：
 * - 主导航永远只有三个入口；设置/通知/资料/账号进入头像菜单或上下文页面；
 * - 高亮以新路由为准；旧路由 /exam /today /plan 经 proxy.ts 跳转，不参与高亮。
 */

export type PrimaryNavId = "opportunities" | "schedule" | "study";

export interface PrimaryNavItem {
  id: PrimaryNavId;
  href: "/" | `/${string}`;
  label: string;
}

export const PRIMARY_NAV: readonly PrimaryNavItem[] = [
  { id: "opportunities", href: "/opportunities", label: "机会" },
  { id: "schedule", href: "/schedule", label: "日程" },
  { id: "study", href: "/study", label: "备考" },
] as const;

/**
 * 路径命中判定：精确匹配或位于该导航分区之下。
 * 使用 `href + "/"` 前缀，避免 `/opportunities-x` 误命中 `/opportunities`。
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

/** 当前命中的主导航项；未命中返回 null（设置、资料等二级页面无高亮） */
export function activeNavId(pathname: string): PrimaryNavId | null {
  const hit = PRIMARY_NAV.find((item) => isNavActive(pathname, item.href));
  return hit ? hit.id : null;
}

/**
 * v5.2 → v6.1 旧路由跳转表。
 * 注意：src/proxy.ts 在 Edge 边界运行、不能可靠共享模块，此表只用于测试与
 * 页面内提示；修改时必须同步 proxy.ts 中的同名字典。
 */
export const LEGACY_ROUTE_REDIRECTS: Readonly<Record<string, string>> = {
  "/exam": "/opportunities",
  "/today": "/study",
  "/plan": "/study",
};
