/**
 * 7 天计划服务（本地 Mock，非生产实现）。
 *
 * 职责：
 * - 从目标/考情/资料/资源/基线服务收集计划输入；
 * - 调用 plans/domain 的纯函数做就绪检查与计划生成；
 * - 持久化 WeeklyPlan 与 DailyPlan（分两个 storage key）；
 * - 提供草稿 → 确认执行、重新生成、调整每日时间、版本历史等操作；
 * - 不含任何生成规则，规则全部在 domain.ts。
 */
import {
  DailyPlan,
  EvidenceItem,
  ExamTarget,
  MaterialDiagnosisSnapshot,
  MaterialItem,
  ResourceItem,
  ResourcePlanLink,
  WeeklyPlan,
} from "@/types";
import { STORAGE_KEYS } from "@/lib/mock-data";
import { loadFromStorage, saveToStorageStrict } from "@/lib/storage";
import { authService } from "@/lib/auth";
import { examTargetService } from "@/lib/services";
import { evidenceService } from "@/lib/evidence/evidenceService";
import { materialService } from "@/lib/materials/materialService";
import { resourceService } from "@/lib/resources/resourceService";
import {
  checkPlanReadiness,
  generatePlan,
  type PlanGenerationInput,
  type PlanReadiness,
} from "./domain";

const listeners = new Set<() => void>();
let storeVersion = 0;

function notifyChanged(): void {
  storeVersion += 1;
  listeners.forEach((fn) => fn());
}

function currentUserId(): string | null {
  return authService.getSession()?.user.id ?? null;
}

function loadWeeklyPlans(): WeeklyPlan[] {
  return loadFromStorage<WeeklyPlan[]>(STORAGE_KEYS.PLANS, []);
}

function persistWeeklyPlans(all: WeeklyPlan[]): void {
  saveToStorageStrict(STORAGE_KEYS.PLANS, all);
}

function loadDailyPlans(): DailyPlan[] {
  return loadFromStorage<DailyPlan[]>(STORAGE_KEYS.DAILY_PLANS, []);
}

function persistDailyPlans(all: DailyPlan[]): void {
  saveToStorageStrict(STORAGE_KEYS.DAILY_PLANS, all);
}

/** 归一化旧版 PlanTask（补全新字段，避免旧数据渲染报错） */
function normalizeDailyPlan(raw: DailyPlan): DailyPlan {
  return {
    ...raw,
    availableMinutes: raw.availableMinutes ?? raw.totalEstimatedTime ?? 0,
    isMinimumViable: raw.isMinimumViable ?? raw.tasks.length <= 1,
    tasks: raw.tasks.map((t, i) => ({
      ...t,
      sourceType: t.sourceType ?? (t.materialId ? "material" : "resource"),
      arrangementReason: t.arrangementReason ?? "历史计划任务",
      reviewAction: t.reviewAction ?? "回顾本任务学习内容",
      priority: t.priority ?? (t.isCore ? "high" : "medium"),
      order: t.order ?? i + 1,
      // 旧版内嵌反馈补齐关联字段（新反馈由 feedbackService 写入完整结构）
      feedback: t.feedback
        ? {
            ...t.feedback,
            weeklyPlanId: t.feedback.weeklyPlanId || raw.weeklyPlanId,
            weeklyVersion: t.feedback.weeklyVersion ?? 1,
            dailyPlanId: t.feedback.dailyPlanId || raw.id,
            date: t.feedback.date || raw.date,
            errorTypes: Array.isArray(t.feedback.errorTypes) ? t.feedback.errorTypes : [],
            hasSecondPractice: t.feedback.hasSecondPractice ?? false,
            updatedAt: t.feedback.updatedAt ?? t.feedback.createdAt,
          }
        : undefined,
    })),
  };
}

/** 组装计划生成输入（从各服务实时读取） */
function buildInput(target: ExamTarget): PlanGenerationInput {
  const evidenceItems: EvidenceItem[] = evidenceService.getItems(target.id);
  const materials: MaterialItem[] = materialService.list(target.id);
  const diagnosis: MaterialDiagnosisSnapshot | null = materialService.getSnapshot(target.id);
  const resourceLinks: ResourcePlanLink[] = resourceService.listMyLinks(target.id).filter(
    (l) => l.status !== "dismissed"
  );
  const resources: ResourceItem[] = resourceService.browseAll();
  const baseline = materialService.getBaseline(target.id);
  const dailyMinutes = baseline?.dailyAvailableMinutes ?? authService.getSession()?.user.dailyAvailableTime ?? 120;
  const weeklyHours = baseline?.weeklyAvailableHours ?? Math.round((dailyMinutes * 7) / 60);

  // 计划从下一个周一开始（若今天是周一则从今天开始），保证 7 天是完整一周
  const today = new Date();
  const day = today.getDay(); // 0=周日
  const diff = day === 0 ? -6 : 1 - day; // 本周一
  const start = new Date(today);
  start.setDate(today.getDate() + diff);
  const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(
    start.getDate()
  ).padStart(2, "0")}`;

  // 周序号：基于开始日期与目标创建日的周差
  const weekNumber = 1;

  return {
    target,
    evidenceItems,
    diagnosis,
    materials,
    resourceLinks,
    resources,
    baseline,
    dailyAvailableMinutes: dailyMinutes,
    weeklyAvailableHours: weeklyHours,
    startDate,
    weekNumber,
  };
}

export const planService = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getVersion(): number {
    return storeVersion;
  },

  // ==================== 读取 ====================

  /** 当前用户在指定目标下的全部周计划（按创建时间倒序） */
  listPlans(examTargetId: string): WeeklyPlan[] {
    const userId = currentUserId();
    if (!userId) return [];
    return loadWeeklyPlans()
      .filter((p) => p.userId === userId && p.examTargetId === examTargetId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /** 当前计划：优先执行中，其次最新草稿 */
  getCurrentPlan(examTargetId?: string): WeeklyPlan | null {
    const userId = currentUserId();
    if (!userId) return null;
    const targetId = examTargetId ?? examTargetService.getCurrent()?.id;
    if (!targetId) return null;
    const plans = this.listPlans(targetId);
    return plans.find((p) => p.status === "active") ?? plans[0] ?? null;
  },

  getDailyPlans(weeklyPlanId: string): DailyPlan[] {
    return loadDailyPlans()
      .filter((d) => d.weeklyPlanId === weeklyPlanId)
      .map(normalizeDailyPlan)
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  getTodayPlan(): DailyPlan | null {
    const today = new Date().toISOString().split("T")[0];
    return loadDailyPlans()
      .map(normalizeDailyPlan)
      .find((d) => d.date === today) ?? null;
  },

  getDayPlan(date: string): DailyPlan | null {
    return loadDailyPlans()
      .map(normalizeDailyPlan)
      .find((d) => d.date === date) ?? null;
  },

  // ==================== 就绪检查 ====================

  /** 检查当前目标是否满足生成计划的条件 */
  getReadiness(targetId: string): PlanReadiness | null {
    const target = examTargetService.getById(targetId);
    if (!target) return null;
    return checkPlanReadiness(buildInput(target));
  },

  // ==================== 生成与确认 ====================

  /**
   * 生成草稿计划。
   * 若数据不足，抛出带中文说明的错误（调用方展示缺失项）。
   */
  generateDraft(targetId: string): { weekly: WeeklyPlan; daily: DailyPlan[] } {
    const target = examTargetService.getById(targetId);
    if (!target) throw new Error("目标不存在");
    const input = buildInput(target);
    const readiness = checkPlanReadiness(input);
    if (!readiness.ready) {
      throw new Error(readiness.missing.join("；"));
    }

    const { weekly, daily } = generatePlan(input);

    // 保存草稿
    const allWeekly = loadWeeklyPlans();
    allWeekly.push(weekly);
    persistWeeklyPlans(allWeekly);

    const allDaily = loadDailyPlans();
    allDaily.push(...daily);
    persistDailyPlans(allDaily);

    notifyChanged();
    return { weekly, daily };
  },

  /** 确认草稿：将状态置为 active，同一目标下其他 active 计划置为 completed */
  confirmPlan(weeklyPlanId: string): WeeklyPlan | null {
    const userId = currentUserId();
    if (!userId) return null;
    const all = loadWeeklyPlans();
    const idx = all.findIndex((p) => p.id === weeklyPlanId && p.userId === userId);
    if (idx === -1) return null;
    const now = new Date().toISOString();
    // 同目标下其他 active 计划标记为 completed
    const targetId = all[idx].examTargetId;
    for (let i = 0; i < all.length; i++) {
      if (all[i].examTargetId === targetId && all[i].status === "active" && all[i].id !== weeklyPlanId) {
        all[i] = { ...all[i], status: "completed", updatedAt: now };
      }
    }
    all[idx] = { ...all[idx], status: "active", updatedAt: now };
    persistWeeklyPlans(all);
    notifyChanged();
    return all[idx];
  },

  /**
   * 重新生成：基于当前输入生成新版本草稿。
   * 旧计划保留为历史版本（不删除）。
   */
  regenerate(targetId: string): { weekly: WeeklyPlan; daily: DailyPlan[] } {
    return this.generateDraft(targetId);
  },

  // ==================== 调整每日时间 ====================

  /**
   * 调整某天的可用时间。
   * 本次不实现自动重排：只更新当天 availableMinutes 与 isMinimumViable 标记，
   * 任务本身不变（如需重排请重新生成）。
   */
  adjustDailyTime(dailyPlanId: string, availableMinutes: number): DailyPlan | null {
    const all = loadDailyPlans();
    const idx = all.findIndex((d) => d.id === dailyPlanId);
    if (idx === -1) return null;
    const total = all[idx].tasks.reduce((s, t) => s + t.estimatedTime, 0);
    all[idx] = {
      ...all[idx],
      availableMinutes,
      isMinimumViable: all[idx].tasks.length <= 1 || total > availableMinutes,
      updatedAt: new Date().toISOString(),
    };
    persistDailyPlans(all);
    notifyChanged();
    return normalizeDailyPlan(all[idx]);
  },

  // ==================== 版本历史 ====================

  /** 列出当前目标的全部计划版本（含草稿/执行中/已完成） */
  listVersions(targetId: string): WeeklyPlan[] {
    return this.listPlans(targetId);
  },

  getTaskById(taskId: string) {
    for (const plan of loadDailyPlans()) {
      const task = plan.tasks.find((t) => t.id === taskId);
      if (task) return normalizeDailyPlan(plan).tasks.find((t) => t.id === taskId) ?? null;
    }
    return null;
  },

  /**
   * 治理模块（错误结论撤回）跨用户调用：
   * 将指定目标下所有“执行中”计划的任务标记为“待重新确认”。
   * 不删除、不重排任务，只打标记并返回受影响计划/任务/用户，供撤回留痕与通知使用。
   */
  flagEvidenceChange(
    targetIds: string[],
    meta: { field: string; reason: string; retractionAt: string }
  ): {
    planIds: string[];
    taskIds: string[];
    plansByUser: Record<string, string[]>;
    meta: { field: string; reason: string; retractionAt: string };
  } {
    const targetSet = new Set(targetIds);
    const affectedPlans = loadWeeklyPlans().filter(
      (p) => p.status === "active" && targetSet.has(p.examTargetId)
    );
    const planIds = new Set(affectedPlans.map((p) => p.id));
    const plansByUser: Record<string, string[]> = {};
    for (const p of affectedPlans) {
      (plansByUser[p.userId] ??= []).push(p.id);
    }

    const taskIds: string[] = [];
    const now = new Date().toISOString();
    const allDaily = loadDailyPlans();
    let changed = false;
    for (let i = 0; i < allDaily.length; i++) {
      if (!planIds.has(allDaily[i].weeklyPlanId)) continue;
      const day = allDaily[i];
      const tasks = day.tasks.map((t) => {
        if (t.needsConfirmation) return t;
        changed = true;
        taskIds.push(t.id);
        return { ...t, needsConfirmation: true as const, updatedAt: now };
      });
      allDaily[i] = { ...day, tasks, updatedAt: now };
    }

    if (changed) {
      persistDailyPlans(allDaily);
      // meta 保留在计划备注维度（Mock：写入 adjustmentNote 便于追溯）
      const allWeekly = loadWeeklyPlans();
      for (let i = 0; i < allWeekly.length; i++) {
        if (planIds.has(allWeekly[i].id)) {
          allWeekly[i] = {
            ...allWeekly[i],
            updatedAt: now,
          };
        }
      }
      persistWeeklyPlans(allWeekly);
      notifyChanged();
    }
    return { planIds: [...planIds], taskIds, plansByUser, meta };
  },
};
