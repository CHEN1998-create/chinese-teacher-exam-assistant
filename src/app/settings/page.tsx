"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { ConfirmModal } from "@/components/ui/Modal";
import { userService } from "@/lib/services";
import { useCurrentUser } from "@/lib/auth";
import {
  EducationLevel,
  EDUCATION_LEVEL_LABELS,
  STAFF_ROLES,
  USER_ROLE_LABELS,
  NotificationSettings,
} from "@/types";

export default function SettingsPage() {
  const router = useRouter();
  const { user, role, hasRole, logout, updateProfile } = useCurrentUser();

  const [isSaving, setIsSaving] = useState(false);
  const [savedTip, setSavedTip] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    educationLevel: user?.educationLevel ?? ("middle" as EducationLevel),
    dailyAvailableTime: user?.dailyAvailableTime ?? 180,
    studyReminderTime: user?.studyReminderTime ?? "08:00",
  });

  const [notifications, setNotifications] = useState<NotificationSettings>(
    user?.notificationSettings ?? {
      studyReminder: true,
      examUpdate: true,
      resourceUpdate: true,
      weeklyReport: true,
    }
  );

  const handleSave = async () => {
    setIsSaving(true);
    // 模拟保存延迟
    await new Promise((r) => setTimeout(r, 300));
    updateProfile({
      educationLevel: formData.educationLevel,
      dailyAvailableTime: formData.dailyAvailableTime,
      studyReminderTime: formData.studyReminderTime,
      notificationSettings: notifications,
    });
    setIsSaving(false);
    setSavedTip(true);
    setTimeout(() => setSavedTip(false), 2000);
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const handleDeleteData = async () => {
    // 清除全部本地业务数据（含演示会话），然后回到登录页
    userService.deleteAllData();
    await logout();
    setIsDeleteModalOpen(false);
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
          <Input
            label="学习提醒时间"
            type="time"
            value={formData.studyReminderTime}
            onChange={(e) =>
              setFormData((p) => ({ ...p, studyReminderTime: e.target.value }))
            }
          />
        </div>
      </Card>

      {/* 通知设置 */}
      <Card>
        <CardHeader title="通知设置" description="管理你希望接收的提醒" />
        <div className="space-y-4">
          <Switch
            label="学习提醒"
            description="每天在你设定的时间提醒开始学习"
            checked={notifications.studyReminder}
            onChange={(checked) =>
              setNotifications((p) => ({ ...p, studyReminder: checked }))
            }
          />
          <Switch
            label="考情变化提醒"
            description="目标考试的公告或考情发生变化时通知你"
            checked={notifications.examUpdate}
            onChange={(checked) =>
              setNotifications((p) => ({ ...p, examUpdate: checked }))
            }
          />
          <Switch
            label="资源更新提醒"
            description="发现适合你的新资源时通知你"
            checked={notifications.resourceUpdate}
            onChange={(checked) =>
              setNotifications((p) => ({ ...p, resourceUpdate: checked }))
            }
          />
          <Switch
            label="每周复盘报告"
            description="每周日发送本周学习情况总结"
            checked={notifications.weeklyReport}
            onChange={(checked) =>
              setNotifications((p) => ({ ...p, weeklyReport: checked }))
            }
          />
        </div>
      </Card>

      {/* 隐私说明 */}
      <Card>
        <CardHeader title="隐私说明" description="了解我们如何保护你的数据" />
        <div className="space-y-3 text-sm text-slate-600">
          <p>• 我们只收集完成备考服务所必需的数据</p>
          <p>• 你的资料默认私有，不会用于训练公共模型</p>
          <p>• 第三方公开资源只展示原始链接和必要摘要</p>
          <p>• 未经单独同意，不会将你的数据用于其他用途</p>
          <p>• 你可以随时申请删除所有个人数据</p>
        </div>
      </Card>

      {/* 数据管理 */}
      <Card>
        <CardHeader title="数据管理" description="查看或删除你的本地数据" />
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              const data = localStorage.getItem("kb_session");
              if (data) {
                const blob = new Blob([data], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "my-session.json";
                a.click();
                URL.revokeObjectURL(url);
              }
            }}
          >
            查看我的会话数据（下载 JSON）
          </Button>
          <Button
            variant="danger"
            className="w-full justify-start"
            onClick={() => setIsDeleteModalOpen(true)}
          >
            删除所有个人数据并退出
          </Button>
        </div>
      </Card>

      {/* 保存按钮 */}
      <div className="flex items-center justify-end gap-3">
        {savedTip && <span className="text-sm text-emerald-600">已保存</span>}
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "保存中..." : "保存设置"}
        </Button>
      </div>

      {/* 删除确认弹窗 */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteData}
        title="删除所有个人数据"
        description="此操作将永久删除本地保存的全部数据，包括目标考试、资料记录、学习计划、反馈和登录会话。删除后需要重新登录，确定要继续吗？"
        confirmLabel="确认删除"
        cancelLabel="取消"
        variant="danger"
      />
    </div>
  );
}
