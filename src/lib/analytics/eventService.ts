/**
 * 统一分析事件服务（本地 Mock 实现，可整体替换为真实后端埋点 SDK）。
 *
 * 职责：
 * - 记录跨模块的用户动作事件与失败事件（track / trackView）；
 * - 事件存储与业务数据一样在 localStorage，但事件流是指标计算的唯一事实来源；
 * - 首次使用时播种一份跨用户、跨时间的演示事件（source="seed"），
 *   让后台概览在没有真实操作时也能展示正常指标；清除数据后事件一并清空并重播。
 *
 * 隐私边界：
 * - 只存账号 ID / 角色 / 模块 / 枚举维度，不存昵称、公告正文、反馈备注、纠错描述；
 * - 失败原因归类为短错误码（classifyErrorCode），不回传原始报错全文；
 * - track 自身永远不向调用方抛错（埋点不能阻断业务）。
 */
import { UserRole } from "@/types";
import { loadFromStorage, saveToStorage, removeFromStorage } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/mock-data";
import { authService } from "@/lib/auth";
import { AnalyticsEvent, AnalyticsEventType, AnalyticsModule } from "./types";

// ==================== 订阅 ====================

const listeners = new Set<() => void>();
let storeVersion = 0;
let seeded = false;

function notifyChanged(): void {
  storeVersion += 1;
  listeners.forEach((fn) => fn());
}

export function subscribeAnalytics(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAnalyticsVersion(): number {
  return storeVersion;
}

// ==================== 工具 ====================

/** 把任意异常归类为短错误码（不保留原文） */
export function classifyErrorCode(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/quota|exceed|空间|限额/i.test(msg)) return "quota_exceeded";
  if (/storage|localStorage|持久化|保存/i.test(msg)) return "storage_unavailable";
  if (/network|网络|timeout|超时/i.test(msg)) return "network_error";
  if (/登录|会话|login|session/i.test(msg)) return "session_expired";
  return "unknown_error";
}

function nowIso(): string {
  return new Date().toISOString();
}

// ==================== 读取与播种 ====================

export function listEvents(): AnalyticsEvent[] {
  if (typeof window === "undefined") return [];
  const existing = loadFromStorage<AnalyticsEvent[] | null>(
    STORAGE_KEYS.ANALYTICS_EVENTS,
    null
  );
  if (existing === null && !seeded) {
    const seed = buildSeedEvents();
    saveToStorage(STORAGE_KEYS.ANALYTICS_EVENTS, seed);
    seeded = true;
    return seed;
  }
  seeded = true;
  return existing ?? [];
}

function persistEvents(events: AnalyticsEvent[]): void {
  saveToStorage(STORAGE_KEYS.ANALYTICS_EVENTS, events);
  notifyChanged();
}

// ==================== 演示辅助：空态 / 重播种子 ====================

/**
 * 演示辅助：清空全部分析事件（只动事件流，不触碰任何业务数据），
 * 用于在后台概览演示“空”状态；真实操作仍会继续写入 live 事件。
 */
export function clearAllEvents(): void {
  if (typeof window === "undefined") return;
  try {
    saveToStorage(STORAGE_KEYS.ANALYTICS_EVENTS, []);
    seeded = true;
    notifyChanged();
  } catch {
    // ignore
  }
}

/** 演示辅助：删除事件存储并恢复首次播种，重新生成 10 个模拟用户的种子事件 */
export function reseedEvents(): void {
  if (typeof window === "undefined") return;
  try {
    removeFromStorage(STORAGE_KEYS.ANALYTICS_EVENTS);
    seeded = false;
    listEvents();
    notifyChanged();
  } catch {
    // ignore
  }
}

// ==================== 写入 ====================

export interface TrackOptions {
  targetId?: string;
  props?: Record<string, string | number | boolean>;
}

/**
 * 记录一条真实操作事件。
 * 未登录（如登录页动作）直接忽略；任何存储异常都被吞掉，绝不影响业务流程。
 */
export function track(
  type: AnalyticsEventType,
  module: AnalyticsModule,
  options: TrackOptions = {}
): void {
  if (typeof window === "undefined") return;
  try {
    const session = authService.getSession();
    if (!session) return;
    const event: AnalyticsEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      at: nowIso(),
      userId: session.user.id,
      userRole: session.user.role as UserRole,
      module,
      targetId: options.targetId,
      source: "live",
      props: options.props,
    };
    const all = listEvents();
    all.push(event);
    persistEvents(all);
  } catch {
    // 埋点失败静默：不能让监控反过来影响主流程
  }
}

/**
 * 记录“查看类”事件：同一会话（sessionStorage）内同一去重键只记一次，
 * 避免切换标签页/重渲染造成指标虚高。
 */
export function trackView(
  dedupKey: string,
  type: AnalyticsEventType,
  module: AnalyticsModule,
  options: TrackOptions = {}
): void {
  if (typeof window === "undefined") return;
  try {
    const key = `kb_av_${type}_${dedupKey}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    track(type, module, options);
  } catch {
    // ignore
  }
}

// ==================== 演示种子 ====================
//
// 模拟 10 个用户在最近 20 天内的不同旅程阶段（全部 source="seed"），
// 使 7 天 / 30 天 / 全部 三个时间范围呈现可验证的差异，并覆盖正常、空、异常状态。
// 种子事件不对应真实业务记录，后台页面会明确标注“演示种子”。

function isoDaysAgo(daysAgo: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function dateDaysAgo(daysAgo: number): string {
  return isoDaysAgo(daysAgo).slice(0, 10);
}

interface SeedSpec {
  user: string;
  /** target_created 距今天数 */
  targetDay: number;
  /** 首次填写是否达到可生成计划门禁 */
  ready: boolean;
  viewDay?: number;
  materialDay?: number;
  diagnosisDay?: number;
  /** 计划：确认天数 / 起始日期距今天数（day1 对应 startDayAgo） */
  confirmDay?: number;
  startDayAgo?: number;
  /** 每日核心任务反馈：[第几天(1-7), 状态] */
  feedback?: [number, "completed" | "partial" | "not_completed"][];
  replanDay?: number;
  reviewDay?: number;
  resource?: { views: number[]; addDay?: number; usedDay?: number };
  correctionDay?: number;
  deleteDay?: number;
  sourceOpenDays?: number[];
}

const SEED_USERS: SeedSpec[] = [
  // 5 个确认计划的用户：3 个走完全闭环，1 个进行到第 5 天，1 个首日中断未回归
  {
    user: "u-m01", targetDay: 18, ready: true, viewDay: 18, materialDay: 18, diagnosisDay: 18,
    confirmDay: 17, startDayAgo: 16,
    feedback: [
      [1, "completed"], [2, "completed"], [3, "not_completed"], [4, "completed"],
      [5, "completed"], [6, "completed"], [7, "partial"],
    ],
    replanDay: 13, reviewDay: 10, correctionDay: 12,
    resource: { views: [18, 15], addDay: 15, usedDay: 14 },
    sourceOpenDays: [16],
  },
  {
    user: "u-m02", targetDay: 13, ready: true, viewDay: 13, materialDay: 13, diagnosisDay: 13,
    confirmDay: 12, startDayAgo: 11,
    feedback: [
      [1, "completed"], [2, "not_completed"], [3, "completed"], [4, "completed"],
      [5, "completed"], [6, "partial"], [7, "completed"],
    ],
    replanDay: 10, reviewDay: 5,
    resource: { views: [12, 9], addDay: 9, usedDay: 7 },
  },
  {
    user: "u-m03", targetDay: 10, ready: true, viewDay: 10, materialDay: 10, diagnosisDay: 10,
    confirmDay: 9, startDayAgo: 8,
    feedback: [
      [1, "completed"], [2, "completed"], [3, "completed"], [4, "completed"],
      [5, "partial"], [6, "not_completed"], [7, "not_completed"],
    ],
    reviewDay: 2, sourceOpenDays: [8],
  },
  {
    user: "u-m04", targetDay: 7, ready: true, viewDay: 7,
    confirmDay: 6, startDayAgo: 5,
    feedback: [
      [1, "completed"], [2, "not_completed"], [3, "completed"], [5, "completed"],
    ],
  },
  {
    user: "u-m05", targetDay: 4, ready: true, viewDay: 4,
    confirmDay: 3, startDayAgo: 2,
    feedback: [[1, "not_completed"]],
  },
  // 停在资料/诊断阶段，计划生成时遭遇写入失败
  {
    user: "u-m06", targetDay: 13, ready: true, viewDay: 13, materialDay: 12, diagnosisDay: 12,
    correctionDay: 4,
  },
  // 看过证据卡后流失
  { user: "u-m07", targetDay: 9, ready: true, viewDay: 9 },
  // 仅创建草稿（信息不足，未达门禁）
  { user: "u-m08", targetDay: 1, ready: false },
  // 已申请注销账号
  { user: "u-m09", targetDay: 15, ready: true, deleteDay: 6 },
  // 只浏览资源未加入计划
  { user: "u-m10", targetDay: 8, ready: true, viewDay: 7, resource: { views: [7] } },
];

function buildSeedEvents(): AnalyticsEvent[] {
  const events: AnalyticsEvent[] = [];
  let seq = 0;
  const push = (
    user: string,
    day: number,
    type: AnalyticsEventType,
    module: AnalyticsModule,
    props?: Record<string, string | number | boolean>,
    targetId?: string,
    hour?: number
  ): void => {
    seq += 1;
    events.push({
      id: `evt-seed-${String(seq).padStart(3, "0")}`,
      type,
      at: isoDaysAgo(day, hour ?? 9),
      userId: user,
      userRole: "user",
      module,
      targetId,
      source: "seed",
      props,
    });
  };

  for (const s of SEED_USERS) {
    const targetId = `et-seed-${s.user}`;
    push(s.user, s.targetDay, "target_created", "target", {
      ready: s.ready ? 1 : 0,
      status: s.ready ? "confirmed" : "draft",
    }, targetId);
    if (s.viewDay !== undefined) push(s.user, s.viewDay, "evidence_viewed", "evidence", {}, targetId);
    if (s.materialDay !== undefined) push(s.user, s.materialDay, "material_added", "material", { sourceType: "published" }, targetId);
    if (s.diagnosisDay !== undefined) push(s.user, s.diagnosisDay, "diagnosis_viewed", "material", {}, targetId);
    (s.sourceOpenDays ?? []).forEach((d) =>
      push(s.user, d, "source_opened", "evidence", { field: "exam_time" }, targetId)
    );
    if (s.correctionDay !== undefined) {
      push(s.user, s.correctionDay, "correction_submitted", "correction", { targetType: "evidence" }, targetId);
    }
    if (s.resource) {
      s.resource.views.forEach((d) =>
        push(s.user, d, "resource_viewed", "resource", { resourceId: "pr-005" })
      );
      if (s.resource.addDay !== undefined) {
        push(s.user, s.resource.addDay, "resource_added_to_plan", "resource", {
          resourceId: "pr-005", module: "mod_zhenti",
        }, targetId);
      }
      if (s.resource.usedDay !== undefined) {
        push(s.user, s.resource.usedDay, "resource_used", "resource", {
          resourceId: "pr-005", stage: "used",
        }, targetId);
      }
    }
    if (s.confirmDay !== undefined && s.startDayAgo !== undefined) {
      const planId = `wp-seed-${s.user}`;
      push(s.user, s.confirmDay, "plan_confirmed", "plan", {
        planId,
        startDate: dateDaysAgo(s.startDayAgo),
        version: 1,
        kind: "initial",
      }, targetId, 20);
      (s.feedback ?? []).forEach(([dayIndex, status]) => {
        push(
          s.user,
          s.startDayAgo! - (dayIndex - 1),
          "task_feedback_submitted",
          "feedback",
          {
            planId,
            date: dateDaysAgo(s.startDayAgo! - (dayIndex - 1)),
            dayIndex,
            status,
            isCore: 1,
          },
          targetId,
          21
        );
      });
      if (s.replanDay !== undefined) {
        push(s.user, s.replanDay, "plan_replanned", "replan", {
          planId, fromVersion: 1, toVersion: 2,
        }, targetId);
      }
      if (s.reviewDay !== undefined) {
        push(s.user, s.reviewDay, "weekly_review_completed", "replan", { planId }, targetId, 21);
      }
    }
    if (s.deleteDay !== undefined) {
      push(s.user, s.deleteDay, "data_delete_requested", "privacy", { scopeCount: 13 }, targetId);
    }
  }

  // —— 质量与运营：人工审核完成（8 条，含 2 条修改后通过） ——
  const reviewSeed: [number, string, string, number, number, number][] = [
    // [距今天数, 证据归属用户, 动作, 处理时长(分钟), 是否高影响, 是否修正]
    [17, "u-m01", "approve", 42, 1, 0],
    [17, "u-m01", "approve", 95, 1, 0],
    [16, "u-m01", "approve_with_edit", 380, 1, 1],
    [12, "u-m02", "approve", 60, 1, 0],
    [11, "u-m02", "approve_with_edit", 260, 0, 1],
    [9, "u-m03", "approve", 150, 1, 0],
    [4, "u-m03", "reject", 75, 0, 0],
    [1, "u-001", "approve", 210, 1, 0],
  ];
  reviewSeed.forEach(([day, owner, action, duration, high, edited], i) => {
    seq += 1;
    events.push({
      id: `evt-seed-rev-${i + 1}`,
      type: "review_completed",
      at: isoDaysAgo(day, 15),
      userId: "u-002",
      userRole: "exam_reviewer",
      module: "review",
      targetId: `et-seed-${owner === "u-001" ? "u-m01" : owner}`,
      source: "seed",
      props: { action, durationMinutes: duration, highImpact: high, edited, ownerId: owner },
    });
  });

  // —— 异常监控种子（6 条） ——
  const failures: [number, string, AnalyticsEventType, AnalyticsModule, Record<string, string | number | boolean>][] = [
    [3, "u-m05", "extraction_failed", "evidence", { jobId: "job-seed-f1", reasonCode: "interrupted" }],
    [1, "u-m07", "extraction_failed", "evidence", { jobId: "job-seed-f2", reasonCode: "extract_error" }],
    [2, "u-m06", "plan_generation_failed", "plan", { reasonCode: "storage_unavailable" }],
    [5, "u-m04", "feedback_submit_failed", "feedback", { reasonCode: "storage_unavailable" }],
    [13, "u-m01", "feedback_submit_failed", "feedback", { reasonCode: "network_error" }],
    [6, "u-m02", "critical_write_failed", "storage", { module: "target", storageKey: "kb_exam_targets", reasonCode: "quota_exceeded" }],
  ];
  failures.forEach(([day, user, type, module, props], i) => {
    seq += 1;
    events.push({
      id: `evt-seed-fail-${i + 1}`,
      type,
      at: isoDaysAgo(day, 11),
      userId: user,
      userRole: "user",
      module,
      source: "seed",
      props,
    });
  });

  return events.sort((a, b) => a.at.localeCompare(b.at));
}
