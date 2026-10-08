"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { useNotificationPreference } from "@/lib/governance/useGovernance";
import { notificationService } from "@/lib/governance/notificationService";
import { NotificationPreference } from "@/types";

/**
 * 通知偏好：修改后立即落库生效（无需“保存设置”）。
 * - 总开关只关闭非必要通知（学习提醒、考情变化）；
 * - 纠错结果、计划重新确认属于必要功能通知，仍有各自开关；
 * - 学习提醒每天最多一条，提醒时间仅用于展示与文案（Mock 无真实定时通道）。
 */
export function NotificationPreferencePanel({
  embedded = false,
  onSaved,
}: {
  embedded?: boolean;
  onSaved?: (message: string) => void;
}) {
  const pref = useNotificationPreference();
  const [error, setError] = useState<string | null>(null);

  if (!pref) return null;

  const update = (patch: Partial<NotificationPreference>, message = "通知设置已更新并立即生效。") => {
    setError(null);
    try {
      notificationService.updatePreference(patch);
      onSaved?.(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "设置更新失败");
    }
  };

  const content = (
    <>
      {!embedded && (
        <CardHeader
          title="通知设置"
          description="所有开关修改后立即生效。我们不做排名提醒、断签提示或惩罚性催促。"
        />
      )}
      {embedded && (
        <p className="mb-4 text-sm leading-relaxed text-ink-muted">
          修改后立即生效。我们只提醒需要处理的事情，不发送排名、断签或惩罚性催促。
        </p>
      )}
      <div className="space-y-4">
        <Switch
          checked={!pref.nonEssentialOff}
          onChange={(checked) => update(
            { nonEssentialOff: !checked },
            checked ? "已开启非必要通知。" : "已关闭学习提醒与考情变化通知。",
          )}
          label="接收非必要通知"
          description="关闭后将不再收到学习提醒与考情变化推送；纠错结果、计划重新确认等必要通知不受影响"
        />

        <div className="border-t border-line pt-4 space-y-4">
          <Switch
            checked={pref.studyReminder && !pref.nonEssentialOff}
            disabled={pref.nonEssentialOff}
            onChange={(checked) => update(
              { studyReminder: checked },
              checked ? "每日学习提醒已开启。" : "每日学习提醒已关闭。",
            )}
            label="每日学习提醒"
            description="每天最多一条，仅在当天有提醒需要时生成"
          />

          <div className="flex items-center gap-3 pl-1">
            <label htmlFor="reminder-time" className="text-sm text-ink-muted shrink-0">
              每日提醒时间
            </label>
            <input
              id="reminder-time"
              type="time"
              value={pref.reminderTime}
              disabled={pref.nonEssentialOff || !pref.studyReminder}
              onChange={(e) => update({ reminderTime: e.target.value }, `提醒时间已改为 ${e.target.value}。`)}
              className="h-9 rounded-lg border border-line px-2 text-sm disabled:bg-canvas disabled:text-ink-muted"
            />
            <span className="text-xs text-ink-muted">
              演示环境仅记录偏好，不会真实定时推送
            </span>
          </div>

          <Switch
            checked={pref.examChange && !pref.nonEssentialOff}
            disabled={pref.nonEssentialOff}
            onChange={(checked) => update(
              { examChange: checked },
              checked ? "重要考情变化提醒已开启。" : "重要考情变化提醒已关闭。",
            )}
            label="重要考情变化"
            description="只在结论撤回等重要变化时通知；没有重要变化不会发送"
          />

          <Switch
            checked={pref.planReconfirm}
            onChange={(checked) => update(
              { planReconfirm: checked },
              checked ? "计划重新确认提醒已开启。" : "计划重新确认提醒已关闭。",
            )}
            label="计划需要重新确认"
            description="考情变化影响本周计划时，提示你重新确认相关任务"
          />

          <Switch
            checked={pref.correctionResult}
            onChange={(checked) => update(
              { correctionResult: checked },
              checked ? "纠错结果提醒已开启。" : "纠错结果提醒已关闭。",
            )}
            label="纠错处理结果"
            description="你的纠错被采纳、未采纳或被要求补充时通知你"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </>
  );

  if (embedded) {
    return <div className="rounded-xl bg-canvas/60 p-3 sm:p-4">{content}</div>;
  }

  return <Card>{content}</Card>;
}
