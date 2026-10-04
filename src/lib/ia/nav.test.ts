import { describe, expect, it } from "vitest";
import {
  PRIMARY_NAV,
  activeNavId,
  isNavActive,
  LEGACY_ROUTE_REDIRECTS,
} from "./nav";

describe("主导航 IA（机会 / 日程 / 备考）", () => {
  it("主导航永远只有三个入口且顺序固定", () => {
    expect(PRIMARY_NAV.map((item) => item.id)).toEqual([
      "opportunities",
      "schedule",
      "study",
    ]);
    expect(PRIMARY_NAV.map((item) => item.href)).toEqual([
      "/opportunities",
      "/schedule",
      "/study",
    ]);
  });

  it("精确路径与子路由正确高亮", () => {
    expect(isNavActive("/opportunities", "/opportunities")).toBe(true);
    expect(isNavActive("/opportunities/unit-hangzhou-01", "/opportunities")).toBe(true);
    expect(isNavActive("/schedule", "/schedule")).toBe(true);
    expect(isNavActive("/study/materials", "/study")).toBe(true);
  });

  it("相似前缀路径不产生误高亮", () => {
    expect(isNavActive("/opportunities-x", "/opportunities")).toBe(false);
    expect(isNavActive("/study2", "/study")).toBe(false);
    expect(isNavActive("/settings", "/schedule")).toBe(false);
  });

  it("二级页面（设置/资料）没有主导航高亮", () => {
    expect(activeNavId("/settings")).toBeNull();
    expect(activeNavId("/materials")).toBeNull();
  });

  it("旧路由跳转表覆盖 /exam /today /plan 且落到语义最接近的新页面", () => {
    expect(LEGACY_ROUTE_REDIRECTS["/exam"]).toBe("/opportunities");
    expect(LEGACY_ROUTE_REDIRECTS["/today"]).toBe("/study");
    expect(LEGACY_ROUTE_REDIRECTS["/plan"]).toBe("/study");
  });
});
