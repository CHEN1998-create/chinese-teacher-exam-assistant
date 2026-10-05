/**
 * 日程与通知服务（v6.1 模块 6）。
 *
 * - 事件从已发布公告版本的 timeline 生成，按用户关注的报考单元落库；
 * - eventKey 用户内唯一，重复同步幂等；新版本变更时间时更新同一记录并追加 changeHistory；
 * - 时间未定（pendingItems）只生成 dateIso=null 的 pending_notice 事件，绝不推测日期；
 * - 已关闭提醒的机会仍在日程中展示，只是不产生通知；
 * - 不接短信/微信/邮件/Web Push，仅站内通知（NotificationRecord）。
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { CATALOG_ANNOUNCEMENTS } from '../matching/catalog.js';
import { currentVersion } from '../matching/engine.js';
import type {
  ApplicationUnit,
  RecruitmentAnnouncement,
} from '../matching/types.js';
import { regionLabel } from './labels.js';
import {
  daysUntil,
  generateEvents,
  isPast,
  KIND_LABELS,
  severityOfChange,
  urgencyOf,
  type NotificationSeverity,
  type RawTimelineEvent,
  type TimelineChangeRecord,
  type TimelineEventKind,
} from './events.domain.js';

export interface TimelineEventDTO {
  id: string;
  unitId: string;
  unitName: string;
  regionText: string;
  registerUrl?: string;
  eventKey: string;
  kind: TimelineEventKind;
  kindLabel: string;
  dateIso: string | null;
  dateText: string;
  pending: boolean;
  urgency: 'must' | 'suggest' | 'info';
  past: boolean;
  action: { label: string; href: string; external?: boolean } | null;
  /** 相比上一版本是否有变更（前端可高亮） */
  changedFromPrevious: {
    field: 'dateIso' | 'title';
    oldValue: string;
    newValue: string;
  } | null;
}

export interface ScheduleResponse {
  meta: { evaluatedAt: string; syncVersion: string };
  events: TimelineEventDTO[];
  /** 已关闭提醒的机会（前端可在对应分组显示“已静音”标记） */
  mutedUnitIds: string[];
}

export interface NotificationDTO {
  id: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  relatedUnitId: string | null;
  readAt: string | null;
  createdAt: string;
}

export const SYNC_VERSION = 'kb-schedule-sync-1.0.0';

const KIND_ORDER: TimelineEventKind[] = [
  'registration_start',
  'registration_end',
  'payment',
  'admit_ticket',
  'written_exam',
  'score',
  'interview',
  'pending_notice',
];

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== 事件同步（按用户关注的机会） ====================

  /**
   * 从当前已发布公告目录重新同步某用户的时间线事件。
   * - 同一 eventKey 已存在且版本未变 → 跳过（幂等）；
   * - 版本变化导致 dateIso/title 变化 → 更新记录并追加 changeHistory，同时产生一条变更通知；
   * - 当前公告版本中不再存在的 eventKey → 标记 superseded（保留记录，不删除）；
   * - 已静音的机会仍同步事件（日程可见），但不产生通知。
   *
   * 返回本次产生的通知数量。
   */
  async syncEventsForUser(userId: string): Promise<number> {
    const follows = await this.prisma.followedOpportunity.findMany({
      where: {
        userId,
        status: { notIn: ['abandoned', 'closed'] },
      },
    });

    const now = new Date();
    const nowIso = now.toISOString();
    const activeKeys = new Set<string>();
    let notificationCount = 0;

    for (const follow of follows) {
      const announcement = CATALOG_ANNOUNCEMENTS.find(
        (a) => a.id === follow.announcementId,
      );
      if (!announcement) continue;
      const version = currentVersion(announcement);
      const unit = version.units.find((u) => u.id === follow.unitId);
      if (!unit) continue;

      const rawEvents = generateEvents(follow.unitId, version.timeline);

      for (const raw of rawEvents) {
        activeKeys.add(raw.eventKey);
        const existing = await this.prisma.timelineEvent.findUnique({
          where: { userId_eventKey: { userId, eventKey: raw.eventKey } },
        });

        if (existing && existing.versionId === version.id) {
          // 同一版本重复同步：幂等，不更新、不产生通知
          if (existing.status === 'superseded') {
            await this.prisma.timelineEvent.update({
              where: { id: existing.id },
              data: { status: 'active' },
            });
          }
          continue;
        }

        if (!existing) {
          await this.prisma.timelineEvent.create({
            data: {
              userId,
              unitId: follow.unitId,
              announcementId: follow.announcementId,
              versionId: version.id,
              eventKey: raw.eventKey,
              kind: raw.kind,
              title: raw.title,
              dateIso: raw.dateIso,
              status: 'active',
              changeHistory: [],
            },
          });
          // 新事件：仅在非静音且为截止类/明确日期时产生 info 通知
          if (!follow.remindersMuted && raw.dateIso) {
            await this.createNotification(
              userId,
              'info',
              `${unit.name} · ${raw.title}`,
              this.notificationBody(raw, unit, version.id, announcement),
              raw.eventKey,
              follow.unitId,
            );
            notificationCount += 1;
          }
          continue;
        }

        // 已有记录但版本变化：比较 dateIso 与 title
        const dateChanged = existing.dateIso !== raw.dateIso;
        const titleChanged = existing.title !== raw.title;
        if (!dateChanged && !titleChanged) {
          // 版本变但值未变：只更新 versionId，不产生通知
          await this.prisma.timelineEvent.update({
            where: { id: existing.id },
            data: { versionId: version.id, status: 'active' },
          });
          continue;
        }

        // 值变化：追加 changeHistory（先捕获旧值，再更新，避免对象引用被覆盖）
        const oldDateIso = existing.dateIso;
        const oldTitle = existing.title;
        const history = (existing.changeHistory as unknown as TimelineChangeRecord[]) ?? [];
        history.push({
          versionId: existing.versionId,
          dateIso: oldDateIso,
          title: oldTitle,
          changedAt: nowIso,
        });
        await this.prisma.timelineEvent.update({
          where: { id: existing.id },
          data: {
            versionId: version.id,
            title: raw.title,
            dateIso: raw.dateIso,
            status: 'active',
            changeHistory: history as unknown as Prisma.InputJsonValue,
          },
        });

        if (!follow.remindersMuted) {
          const severity = severityOfChange(raw.kind, oldDateIso, raw.dateIso);
          await this.createNotification(
            userId,
            severity,
            `${unit.name} · ${raw.title}时间有更新`,
            this.changeNotificationBody(raw, oldDateIso, oldTitle, unit),
            raw.eventKey,
            follow.unitId,
          );
          notificationCount += 1;
        }
      }
    }

    // 当前版本中不再存在的事件 → superseded（保留记录）
    if (activeKeys.size > 0) {
      await this.prisma.timelineEvent.updateMany({
        where: {
          userId,
          status: 'active',
          eventKey: { notIn: Array.from(activeKeys) },
        },
        data: { status: 'superseded' },
      });
    }

    return notificationCount;
  }

  // ==================== 日程查询 ====================

  async getSchedule(userId: string): Promise<ScheduleResponse> {
    // 先同步再查询，保证拿到最新公告版本的事件
    await this.syncEventsForUser(userId);

    const nowIso = new Date().toISOString();
    const events = await this.prisma.timelineEvent.findMany({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'asc' },
    });

    // 取关注记录（含静音标记）与单元元信息
    const follows = await this.prisma.followedOpportunity.findMany({
      where: { userId, status: { notIn: ['abandoned', 'closed'] } },
    });
    const mutedUnitIds = follows.filter((f) => f.remindersMuted).map((f) => f.unitId);
    const unitMeta = new Map<string, { name: string; regionText: string; registerUrl?: string }>();
    for (const f of follows) {
      const ann = CATALOG_ANNOUNCEMENTS.find((a) => a.id === f.announcementId);
      if (!ann) continue;
      const unit = currentVersion(ann).units.find((u) => u.id === f.unitId);
      if (!unit) continue;
      unitMeta.set(f.unitId, {
        name: unit.name,
        regionText: regionLabel(unit.region),
        registerUrl: unit.registerUrl,
      });
    }

    const dtos: TimelineEventDTO[] = events
      .map((e) => {
        const meta = unitMeta.get(e.unitId);
        if (!meta) return null;
        return this.toDTO(e, meta, nowIso);
      })
      .filter((d): d is TimelineEventDTO => d !== null)
      .sort((a, b) => {
        const byKind =
          KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
        if (byKind !== 0) return byKind;
        return (a.dateIso ?? '').localeCompare(b.dateIso ?? '');
      });

    return {
      meta: { evaluatedAt: nowIso, syncVersion: SYNC_VERSION },
      events: dtos,
      mutedUnitIds,
    };
  }

  // ==================== 通知 ====================

  async listNotifications(userId: string): Promise<NotificationDTO[]> {
    const rows = await this.prisma.notificationRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      severity: r.severity as NotificationSeverity,
      title: r.title,
      body: r.body,
      relatedUnitId: r.relatedUnitId,
      readAt: r.readAt ? r.readAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notificationRecord.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notificationRecord.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  // ==================== 内部工具 ====================

  private toDTO(
    row: {
      id: string;
      unitId: string;
      eventKey: string;
      kind: string;
      title: string;
      dateIso: string | null;
      changeHistory: Prisma.JsonValue;
    },
    meta: { name: string; regionText: string; registerUrl?: string },
    nowIso: string,
  ): TimelineEventDTO {
    const kind = row.kind as TimelineEventKind;
    const d = daysUntil(row.dateIso, nowIso);
    const past = isPast(row.dateIso, nowIso);
    const urgency = urgencyOf(kind, d);
    const action = this.buildAction(kind, row.dateIso, past, meta.registerUrl);

    // 检测是否有变更历史（最近一次）
    const history = (row.changeHistory as unknown as TimelineChangeRecord[]) ?? [];
    let changedFromPrevious: TimelineEventDTO['changedFromPrevious'] = null;
    if (history.length > 0) {
      const last = history[history.length - 1];
      if (last.dateIso !== row.dateIso) {
        changedFromPrevious = {
          field: 'dateIso',
          oldValue: last.dateIso ?? '待官方通知',
          newValue: row.dateIso ?? '待官方通知',
        };
      } else if (last.title !== row.title) {
        changedFromPrevious = {
          field: 'title',
          oldValue: last.title,
          newValue: row.title,
        };
      }
    }

    return {
      id: row.id,
      unitId: row.unitId,
      unitName: meta.name,
      regionText: meta.regionText,
      registerUrl: meta.registerUrl,
      eventKey: row.eventKey,
      kind,
      kindLabel: KIND_LABELS[kind],
      dateIso: row.dateIso,
      dateText: row.dateIso ? this.formatDate(row.dateIso) : '待官方通知',
      pending: row.dateIso === null,
      urgency,
      past,
      action,
      changedFromPrevious,
    };
  }

  private buildAction(
    kind: TimelineEventKind,
    dateIso: string | null,
    past: boolean,
    registerUrl?: string,
  ): TimelineEventDTO['action'] {
    if (past || !dateIso) return null;
    if (kind === 'registration_end' && registerUrl) {
      return { label: '去报名入口', href: registerUrl, external: true };
    }
    if (kind === 'registration_start' && registerUrl) {
      return { label: '查看报名入口', href: registerUrl, external: true };
    }
    if (kind === 'written_exam' || kind === 'interview') {
      return { label: '去备考', href: '/study' };
    }
    return null;
  }

  private formatDate(iso: string): string {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
  }

  private async createNotification(
    userId: string,
    severity: NotificationSeverity,
    title: string,
    body: string,
    eventKey: string,
    relatedUnitId: string,
  ): Promise<void> {
    await this.prisma.notificationRecord.create({
      data: {
        userId,
        severity,
        title,
        body,
        eventKey,
        relatedUnitId,
      },
    });
  }

  private notificationBody(
    raw: RawTimelineEvent,
    unit: ApplicationUnit,
    versionId: string,
    announcement: RecruitmentAnnouncement,
  ): string {
    const dateText = raw.dateIso
      ? this.formatDate(raw.dateIso)
      : '待官方通知';
    return `${announcement.publisher}发布的${unit.name}，${raw.title}：${dateText}。请留意后续安排。`;
  }

  private changeNotificationBody(
    raw: RawTimelineEvent,
    oldDateIso: string | null,
    oldTitle: string,
    unit: ApplicationUnit,
  ): string {
    const oldText = oldDateIso ? this.formatDate(oldDateIso) : '待官方通知';
    const newText = raw.dateIso ? this.formatDate(raw.dateIso) : '待官方通知';
    if (oldDateIso !== raw.dateIso) {
      return `${unit.name}的${raw.title}时间已更新：${oldText} → ${newText}。请据此调整你的安排。`;
    }
    return `${unit.name}的事项描述已更新：「${oldTitle}」→「${raw.title}」。`;
  }
}
