"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { ConfirmModal } from "@/components/ui/Modal";
import { userService } from "@/lib/services";
import { EducationLevel, EDUCATION_LEVEL_LABELS } from "@/types";

export default function SettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [, setIsDeleting] = useState(false);

  const settings = userService.getSettings();

  const [formData, setFormData] = useState({
    educationLevel: settings.educationLevel || ("middle" as EducationLevel),
    dailyAvailableTime: settings.dailyAvailableTime,
    studyReminderTime: settings.studyReminderTime || "08:00",
  });

  const [notifications, setNotifications] = useState(settings.notifications);

  const handleSave = async () => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    userService.updateSettings({
      educationLevel: formData.educationLevel,
      dailyAvailableTime: formData.dailyAvailableTime,
      studyReminderTime: formData.studyReminderTime,
      notifications,
    });
    userService.updateUser({
      educationLevel: formData.educationLevel,
      dailyAvailableTime: formData.dailyAvailableTime,
      notificationSettings: notifications,
    });
    setIsLoading(false);
  };

  const handleDeleteData = async () => {
    setIsDeleting(true);
    await new Promise((r) => setTimeout(r, 500));
    userService.deleteAllData();
    setIsDeleting(false);
    setIsDeleteModalOpen(false);
    router.push("/onboarding");
  };

  return (
    <div className="space-y-6">
      {/* 基本信息 */}
      <Card>
        <CardHeader
          title="基本信息"
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
        <CardHeader
          title="通知设置"
          description="管理你希望接收的提醒"
        />
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
        <CardHeader title="数据管理" description="查看或删除你的个人数据" />
        <div className="space-y-3">
          <Button variant="outline" className="w-full justify-start">
            查看我的数据（下载 JSON）
          </Button>
          <Button
            variant="danger"
            className="w-full justify-start"
            onClick={() => setIsDeleteModalOpen(true)}
          >
            删除所有个人数据
          </Button>
        </div>
      </Card>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? "保存中..." : "保存设置"}
        </Button>
      </div>

      {/* 删除确认弹窗 */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteData}
        title="删除所有个人数据"
        description="此操作将永久删除你的所有数据，包括目标考试、资料记录、学习计划和反馈。删除后无法恢复，确定要继续吗？"
        confirmLabel="确认删除"
        cancelLabel="取消"
        variant="danger"
      />
    </div>
  );
}
