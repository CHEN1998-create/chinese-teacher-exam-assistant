"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Input";
import { NotificationPreferencePanel } from "@/components/governance/NotificationPreferencePanel";
import { DataPrivacyPanel } from "@/components/governance/DataPrivacyPanel";
import { useCurrentUser } from "@/lib/auth";
import {
  EducationLevel,
  EDUCATION_LEVEL_LABELS,
  STAFF_ROLES,
  USER_ROLE_LABELS,
} from "@/types";

export default function SettingsPage() {
  const router = useRouter();
  const { user, role, hasRole, logout, updateProfile } = useCurrentUser();

  const [isSaving, setIsSaving] = useState(false);
  const [savedTip, setSavedTip] = useState(false);

  const [formData, setFormData] = useState({
    educationLevel: user?.educationLevel ?? ("middle" as EducationLevel),
    dailyAvailableTime: user?.dailyAvailableTime ?? 180,
  });

  const handleSave = async () => {
    setIsSaving(true);
    // 模拟保存延迟
    await new Promise((r) => setTimeout(r, 300));
    updateProfile({
      educationLevel: formData.educationLevel,
      dailyAvailableTime: formData.dailyAvailableTime,
    });
    setIsSaving(false);
    setSavedTip(true);
    setTimeout(() => setSavedTip(false), 2000);
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  if (!user || !role) return null;

  return (
    <div className="space-y-6">
      {/* 账号信息 */}
      <Card>
        <CardHeader title="账号信息" description="当前登录会话与角色" />
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-xl">👤</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-slate-900">{user.name}</p>
              <Badge variant="primary">{USER_ROLE_LABELS[role]}</Badge>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">用户ID：{user.id}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={handleLogout}>
            退出登录
          </Button>
          {hasRole(STAFF_ROLES) && (
            <Link href="/admin">
              <Button variant="outline" size="sm">
                进入运营后台
              </Button>
            </Link>
          )}
        </div>
      </Card>

      {/* 基本信息 */}
      <Card>
        <CardHeader
          title="学习资料设置"
          description="设置你的学段和每日可用学习时间"
        />
        <div className="space-y-4">
          <Select
            label="学段"
            options={Object.entries(EDUCATION_LEVEL_LABELS).map(([v, l]) => ({
              value: v,
              label: l,
            }))}
            value={formData.educationLevel}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                educationLevel: e.target.value as EducationLevel,
              }))
            }
          />
          <Input
            label="每日可用时间（分钟）"
            type="number"
            value={formData.dailyAvailableTime}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                dailyAvailableTime: parseInt(e.target.value) || 180,
              }))
            }
            hint="建议 60-300 分钟，系统会根据此安排每日任务"
          />
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          {savedTip && <span className="text-sm text-emerald-600">已保存</span>}
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "保存中..." : "保存设置"}
          </Button>
        </div>
      </Card>

      {/* 通知设置（即时生效，无需保存） */}
      <NotificationPreferencePanel />

      {/* 隐私说明、数据类别与删除申请 */}
      <DataPrivacyPanel />
    </div>
  );
}
