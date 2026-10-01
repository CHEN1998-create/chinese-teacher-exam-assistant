"use client";

import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useCurrentUser } from "@/lib/auth";
import { USER_ROLE_LABELS } from "@/types";
import { useReviewQueue } from "@/lib/admin/useAdminReviews";
import { useAdminResources } from "@/lib/resources/useResources";

interface AdminModule {
  title: string;
  path: string;
  desc: string;
  available: boolean;
  roles: string[];
}

export default function AdminHomePage() {
  const { role } = useCurrentUser();
  const { counts } = useReviewQueue("pending");
  const { queues } = useAdminResources();

  const modules: AdminModule[] = [
    {
      title: "考情与证据",
      path: "/admin/exams",
      desc: "按目标查看证据状态、来源、适用范围，进入审核",
      available: true,
      roles: ["考情审核员", "资源审核员（只读）", "管理员"],
    },
    {
      title: "审核队列",
      path: "/admin/reviews",
      desc: `待审核 ${counts.pending} · 冲突 ${counts.conflict} · 临期 ${counts.expiring} · 已完成 ${counts.completed}`,
      available: true,
      roles: ["考情审核员", "资源审核员（仅低影响）", "管理员"],
    },
    {
      title: "资源索引",
      path: "/admin/resources",
      desc: `正常 ${queues.active.length} · 待复核 ${queues.pending_review.length} · 已失效 ${queues.expired.length} · 已停用 ${queues.inactive.length}`,
      available: true,
      roles: ["管理员", "资源审核员（可写）", "考情审核员（只读）"],
    },
    {
      title: "纠错与治理",
      path: "/admin/feedback",
      desc: "处理纠错、查看修改和大范围撤回记录",
      available: false,
      roles: ["管理员"],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">后台概览</h1>
        <p className="text-sm text-slate-500 mt-1">
          当前角色：{role ? USER_ROLE_LABELS[role] : "-"}
          。高影响考情（报名时间/考试日期/科目/分值/资格条件）仅考情审核员与管理员可操作
        </p>
      </div>

      {/* 演示提示 */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
        <p className="text-sm text-amber-800">
          考情审核与公共资源索引模块已上线（本地 Mock，非生产实现）：审核动作、资源维护、查看/加入计划记录均存储在浏览器
          localStorage；纠错治理等能力将在后续模块提供。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modules.map((mod) => (
          <Card key={mod.path} className={mod.available ? "" : "opacity-80"}>
            <CardHeader
              title={mod.title}
              description={mod.desc}
              action={<Badge variant={mod.available ? "success" : "muted"}>{mod.available ? "已上线" : "占位"}</Badge>}
            />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-400">{mod.path}</p>
                <p className="mt-0.5 text-[11px] text-slate-400 truncate">
                  可访问角色：{mod.roles.join("、")}
                </p>
              </div>
              {mod.available ? (
                <Link
                  href={mod.path}
                  className="shrink-0 h-8 px-3 inline-flex items-center rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  进入
                </Link>
              ) : (
                <button
                  disabled
                  className="shrink-0 h-8 px-3 rounded-lg text-xs font-medium text-slate-400 bg-slate-100 cursor-not-allowed"
                >
                  未开放
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
