"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useCurrentUser, DEMO_ACCOUNTS } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, status } = useCurrentUser();

  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const nextParam = searchParams.get("next");
  const reason = searchParams.get("reason");

  // 会话过期标记（由 DemoAuthProvider 写入 sessionStorage）
  const [sessionExpired] = useState(() => {
    if (typeof window === "undefined") return false;
    const expired = window.sessionStorage.getItem("kb_session_expired") === "1";
    if (expired) window.sessionStorage.removeItem("kb_session_expired");
    return expired;
  });

  const safeNext = (value: string | null): string | null => {
    if (!value) return null;
    // 只允许站内相对路径，防止开放重定向
    if (!value.startsWith("/") || value.startsWith("//")) return null;
    return value;
  };

  // 已登录用户访问登录页时直接跳转
  useEffect(() => {
    if (status === "authenticated") {
      router.replace(safeNext(nextParam) ?? "/exam");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const fillDemoAccount = (demoAccount: string, demoPassword: string) => {
    setAccount(demoAccount);
    setPassword(demoPassword);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!account.trim() || !password) {
      setError("请输入账号和密码");
      return;
    }

    setSubmitting(true);
    try {
      await login({ account: account.trim(), password });
      router.replace(safeNext(nextParam) ?? "/exam");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* 品牌区 */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">📝</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">语文教师编备考助手</h1>
          <p className="text-sm text-slate-500 mt-1">登录后继续你的备考计划</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          {/* Demo 声明 */}
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-xs leading-5 text-amber-800">
              <strong>演示环境提示：</strong>
              这里使用的是内置演示账号，<strong>不是真实身份认证</strong>，没有真实注册与密码校验；
              演示数据仅保存在本机浏览器，不代表正式服务数据。请勿输入真实密码或其他个人信息。
            </p>
          </div>

          {/* 会话失效提示 */}
          {(sessionExpired || reason === "expired") && (
            <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-xs leading-5 text-slate-600">
                登录状态已过期，请重新登录。
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="account"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                账号
              </label>
              <input
                id="account"
                type="text"
                autoComplete="username"
                placeholder="演示邮箱，例如 student@demo.app"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                密码
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="演示密码：demo1234"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button type="submit" fullWidth size="lg" disabled={submitting}>
              {submitting ? "登录中..." : "登录"}
            </Button>
          </form>

          {/* 演示账号快捷填充 */}
          <div className="mt-6">
            <p className="text-xs font-medium text-slate-500 mb-2">
              演示账号（点击自动填充，密码均为 demo1234）
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((item) => (
                <button
                  key={item.account}
                  type="button"
                  onClick={() => fillDemoAccount(item.account, item.password)}
                  className="text-left p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                >
                  <p className="text-sm font-medium text-slate-900">{item.description}</p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{item.account}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          未注册账号？Demo 阶段无需注册，请直接使用演示账号
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams 需要 Suspense 边界以支持静态预渲染
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
