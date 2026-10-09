import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * v5.2 → v6.1 旧路由兼容跳转（模块 3，模块 9 随旧页面删除保留）。
 *
 * Next.js 16 起 middleware 文件约定改名为 proxy（功能不变、默认 Node.js runtime）。
 * 模块 9 已删除 app/exam、app/today、app/plans 旧页面，本 proxy 是这些旧链接
 * （收藏夹、旧通知、外部文档）仍能到达新页面的唯一保障，不可随页面一起删除。
 *
 * 注意：proxy 仍不建议依赖共享模块或全局状态（与渲染代码分离部署）；
 * 此映射需与 src/lib/ia/nav.ts 的 LEGACY_ROUTE_REDIRECTS 保持一致
 * （proxy.test.ts 锁定）。
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
