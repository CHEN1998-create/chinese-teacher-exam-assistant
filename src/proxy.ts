import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * v5.2 → v6.1 旧路由兼容跳转（模块 3）。
 *
 * 旧页面代码（app/today、app/plan、app/exam）暂不删除，待模块 9 确认无调用方
 * 后再清理；本文件独立回退即可恢复旧路由直达。
 * 注意：proxy 在 Edge 边界运行，不共享应用模块，此映射需与
 * src/lib/ia/nav.ts 的 LEGACY_ROUTE_REDIRECTS 保持一致。
 */
const LEGACY_REDIRECTS: Record<string, string> = {
  "/exam": "/opportunities",
  "/today": "/study",
  "/plan": "/study",
};

export function proxy(request: NextRequest) {
  const target = LEGACY_REDIRECTS[request.nextUrl.pathname];
  if (!target) return NextResponse.next();

  // clone 保留查询参数（如 ?target=xxx），落到语义最接近的新页面
  const url = request.nextUrl.clone();
  url.pathname = target;
  return NextResponse.redirect(url, 307);
}

export const config = {
  matcher: ["/exam", "/today", "/plan"],
};
