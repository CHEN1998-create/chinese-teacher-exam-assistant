"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useCurrentUser } from "@/lib/auth";
import { USER_ROLE_LABELS } from "@/types";

const placeholderModules = [
  {
    title: "后台概览",
    path: "/admin",
    desc: "待审核、纠错、资源失效和业务漏斗",
    roles: ["admin"],
  },
  {
    title: "考情与证据",
    path: "/admin/exams",
    desc: "维护考试、来源、适用范围和版本",
    roles: ["admin", "考情审核员"],
  },
  {
    title: "资源索引",
    path: "/admin/resources",
    desc: "维护来源、版权、适用范围和失效状态",
    roles: ["admin", "资源审核员"],
  },
  {
    title: "审核队列",
    path: "/admin/reviews",
    desc: "审核 AI 提取结果和高影响事实",
    roles: ["admin", "考情审核员", "资源审核员"],
  },
  {
    title: "纠错与记录",
    path: "/admin/feedback",
    desc: "处理纠错、查看修改和撤回记录",
    roles: ["admin"],
  },
];

export default function AdminHomePage() {
  const { role } = useCurrentUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">后台概览</h1>
        <p className="text-sm text-slate-500 mt-1">
          当前角色：{role ? USER_ROLE_LABELS[role] : "-"} · 后台功能将在后续模块实现，本页为占位
        </p>
      </div>

      {/* 演示占位提示 */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
        <p className="text-sm text-amber-800">
          这里是运营审核后台的前端占位。审核、发布、撤回、资源失效等真实能力尚未接入，
          本次仅完成登录识别与角色级路由保护。
        </p>
      </div>

      {/* 功能模块占位 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {placeholderModules.map((mod) => (
          <Card key={mod.path} className="opacity-80">
            <CardHeader
              title={mod.title}
              description={mod.desc}
              action={<Badge variant="muted">占位</Badge>}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">{mod.path}</p>
              <button
                disabled
                className="h-8 px-3 rounded-lg text-xs font-medium text-slate-400 bg-slate-100 cursor-not-allowed"
              >
                未开放
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
