import { NextRequest, NextResponse } from 'next/server';

// 始终动态执行，不缓存任何上游响应
export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL;
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN;

type ForwardMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
): Promise<NextResponse> {
  if (!BACKEND_URL || !INTERNAL_TOKEN) {
    return NextResponse.json(
      { error: 'proxy not configured' },
      { status: 503 },
    );
  }

  const { path: segments } = await context.params;
  const target = `${BACKEND_URL.replace(/\/$/, '')}/${(segments ?? []).join('/')}`;

  // 透传查询参数
  const search = request.nextUrl.search;
  const url = `${target}${search}`;

  // 仅转发必要的请求头，避免 host/content-length 等污染上游
  const headers = new Headers();
  const passthrough = [
    'content-type',
    'accept',
    'accept-language',
    'cookie',
    'user-agent',
    // 用户身份头：由前端从本地会话注入，供后端 AdminGuard 做服务端权限校验。
    // 接入真实认证后，应由代理校验 token 后注入真实身份，而非透传客户端值。
    'x-user-id',
    'x-user-role',
    'x-user-name',
  ];
  for (const name of passthrough) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-internal-token', INTERNAL_TOKEN);

  const method = request.method.toUpperCase() as ForwardMethod;
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? Buffer.from(await request.arrayBuffer()) : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(url, { method, headers, body, cache: 'no-store' });
  } catch {
    return NextResponse.json({ error: 'upstream unreachable' }, { status: 502 });
  }

  // fetch 已自动解压，删除可能导致二次解码错误的头
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');

  const buffer = Buffer.from(await upstream.arrayBuffer());
  return new NextResponse(buffer, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;
