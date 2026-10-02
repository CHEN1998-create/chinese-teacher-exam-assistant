import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * 公开演示环境安全响应头：
 * - 浏览器基础防护：nosniff / Referrer-Policy / 禁止 iframe 嵌入 / 禁用无关能力
 * - X-Robots-Tag：禁止搜索引擎收录演示站
 * - CSP：只允许同源资源；开发环境放开 unsafe-eval 以支持 HMR / Fast Refresh
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  // Next 生产产物含少量内联引导脚本，未启用 nonce 方案前保留 unsafe-inline
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "X-Robots-Tag", value: "none" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
