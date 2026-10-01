import {
  ExamTarget,
  EvidenceCard,
  UserMaterial,
  PublicResource,
  WeeklyPlan,
  DailyPlan,
  PlanTask,
  TaskFeedback,
  User,
  UserSettings,
  MaterialStatus,
} from "@/types";
import {
  mockUser,
  mockExamTargets,
  mockEvidenceCards,
  mockUserMaterials,
  mockPublicResources,
  mockWeeklyPlan,
  mockDailyPlans,
  mockUserSettings,
  STORAGE_KEYS,
} from "./mock-data";
import { loadFromStorage, saveToStorage, clearAllStorage } from "./storage";

// ==================== 用户服务 ====================

export const userService = {
  getUser(): User {
    return loadFromStorage(STORAGE_KEYS.USER, mockUser);
  },

  updateUser(updates: Partial<User>): User {
    const user = this.getUser();
    const updated = { ...user, ...updates, updatedAt: new Date().toISOString() };
    saveToStorage(STORAGE_KEYS.USER, updated);
    return updated;
  },

  getSettings(): UserSettings {
    return loadFromStorage(STORAGE_KEYS.SETTINGS, mockUserSettings);
  },

  updateSettings(updates: Partial<UserSettings>): UserSettings {
    const settings = this.getSettings();
    const updated = { ...settings, ...updates };
    saveToStorage(STORAGE_KEYS.SETTINGS, updated);
    return updated;
  },

  deleteAllData(): void {
    clearAllStorage();
  },
};

// ==================== 目标考试服务 ====================

export const examTargetService = {
  getAll(): ExamTarget[] {
    return loadFromStorage(STORAGE_KEYS.EXAM_TARGETS, mockExamTargets);
  },

  getCurrent(): ExamTarget | null {
    const targets = this.getAll();
    const currentId = loadFromStorage(STORAGE_KEYS.USER, mockUser).currentExamTargetId;
    return targets.find((t) => t.id === currentId) || targets.find((t) => t.isCurrent) || null;
  },

  getById(id: string): ExamTarget | null {
    return this.getAll().find((t) => t.id === id) || null;
  },

  create(data: Omit<ExamTarget, "id" | "userId" | "createdAt" | "updatedAt">): ExamTarget {
    const targets = this.getAll();
    const newTarget: ExamTarget = {
      ...data,
      id: `et-${Date.now()}`,
      userId: userService.getUser().id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    targets.push(newTarget);
    saveToStorage(STORAGE_KEYS.EXAM_TARGETS, targets);
    return newTarget;
  },

  update(id: string, updates: Partial<ExamTarget>): ExamTarget | null {
    const targets = this.getAll();
    const index = targets.findIndex((t) => t.id === id);
    if (index === -1) return null;
    targets[index] = { ...targets[index], ...updates, updatedAt: new Date().toISOString() };
    saveToStorage(STORAGE_KEYS.EXAM_TARGETS, targets);
    return targets[index];
  },

  setCurrent(id: string): void {
    const targets = this.getAll().map((t) => ({
      ...t,
      isCurrent: t.id === id,
    }));
    saveToStorage(STORAGE_KEYS.EXAM_TARGETS, targets);
    userService.updateUser({ currentExamTargetId: id });
  },
};

// ==================== 证据卡服务 ====================

export const evidenceService = {
  getByExamTargetId(examTargetId: string): EvidenceCard[] {
    return loadFromStorage(STORAGE_KEYS.EVIDENCE_CARDS, mockEvidenceCards).filter(
      (e) => e.examTargetId === examTargetId
    );
  },

  getByLevel(examTargetId: string, level: string): EvidenceCard[] {
    return this.getByExamTargetId(examTargetId).filter((e) => e.level === level);
  },

  getConfirmed(examTargetId: string): EvidenceCard[] {
    return this.getByLevel(examTargetId, "official");
  },

  getPending(examTargetId: string): EvidenceCard[] {
    return this.getByLevel(examTargetId, "pending");
  },
};

// ==================== 用户资料服务 ====================

export const materialService = {
  getAll(): UserMaterial[] {
    return loadFromStorage(STORAGE_KEYS.MATERIALS, mockUserMaterials);
  },

  getByExamTargetId(examTargetId: string): UserMaterial[] {
    return this.getAll().filter((m) => m.examTargetId === examTargetId);
  },

  getById(id: string): UserMaterial | null {
    return this.getAll().find((m) => m.id === id) || null;
  },

  create(data: Omit<UserMaterial, "id" | "userId" | "createdAt" | "updatedAt">): UserMaterial {
    const materials = this.getAll();
    const newMaterial: UserMaterial = {
      ...data,
      id: `um-${Date.now()}`,
      userId: userService.getUser().id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    materials.push(newMaterial);
    saveToStorage(STORAGE_KEYS.MATERIALS, materials);
    return newMaterial;
  },

  updateStatus(id: string, status: MaterialStatus): UserMaterial | null {
    const materials = this.getAll();
    const index = materials.findIndex((m) => m.id === id);
    if (index === -1) return null;
    materials[index] = { ...materials[index], status, updatedAt: new Date().toISOString() };
    saveToStorage(STORAGE_KEYS.MATERIALS, materials);
    return materials[index];
  },

  updateProgress(id: string, progress: number, currentChapterId?: string): UserMaterial | null {
    const materials = this.getAll();
    const index = materials.findIndex((m) => m.id === id);
    if (index === -1) return null;
    materials[index] = {
      ...materials[index],
      progress,
      currentChapterId: currentChapterId || materials[index].currentChapterId,
      updatedAt: new Date().toISOString(),
    };
    saveToStorage(STORAGE_KEYS.MATERIALS, materials);
    return materials[index];
  },
};

// ==================== 公共资源服务 ====================

export const resourceService = {
  getAll(): PublicResource[] {
    return loadFromStorage(STORAGE_KEYS.EXAM_TARGETS, mockPublicResources);
  },

  getRecommended(limit: number = 3): PublicResource[] {
    return this.getAll()
      .filter((r) => r.isVerified && r.isActive)
      .slice(0, limit);
  },

  getByModule(module: string): PublicResource[] {
    return this.getAll().filter((r) => r.modules.includes(module));
  },

  getById(id: string): PublicResource | null {
    return this.getAll().find((r) => r.id === id) || null;
  },
};

// ==================== 计划服务 ====================

export const planService = {
  getCurrentPlan(): WeeklyPlan | null {
    const plans = loadFromStorage<WeeklyPlan[]>(STORAGE_KEYS.PLANS, [mockWeeklyPlan]);
    return plans.find((p) => p.status === "active") || plans[0] || null;
  },

  getDailyPlans(weeklyPlanId: string): DailyPlan[] {
    return loadFromStorage<DailyPlan[]>(STORAGE_KEYS.PLANS, mockDailyPlans).filter(
      (d) => d.weeklyPlanId === weeklyPlanId
    );
  },

  getTodayPlan(): DailyPlan | null {
    const today = new Date().toISOString().split("T")[0];
    const dailyPlans = loadFromStorage<DailyPlan[]>(STORAGE_KEYS.PLANS, mockDailyPlans);
    return dailyPlans.find((d) => d.date === today) || null;
  },

  getDayPlan(date: string): DailyPlan | null {
    const dailyPlans = loadFromStorage<DailyPlan[]>(STORAGE_KEYS.PLANS, mockDailyPlans);
    return dailyPlans.find((d) => d.date === date) || null;
  },

  submitTaskFeedback(taskId: string, feedback: Omit<TaskFeedback, "id" | "createdAt">): void {
    const dailyPlans = loadFromStorage<DailyPlan[]>(STORAGE_KEYS.PLANS, mockDailyPlans);
    const newFeedback: TaskFeedback = {
      ...feedback,
      id: `tf-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    for (const plan of dailyPlans) {
      const taskIndex = plan.tasks.findIndex((t) => t.id === taskId);
      if (taskIndex !== -1) {
        plan.tasks[taskIndex] = {
          ...plan.tasks[taskIndex],
          status: feedback.status === "completed" ? "completed" : feedback.status === "partial" ? "partial" : "pending",
          feedback: newFeedback,
          updatedAt: new Date().toISOString(),
        };
        break;
      }
    }

    saveToStorage(STORAGE_KEYS.PLANS, dailyPlans);
  },

  getTaskById(taskId: string): PlanTask | null {
    const dailyPlans = loadFromStorage<DailyPlan[]>(STORAGE_KEYS.PLANS, mockDailyPlans);
    for (const plan of dailyPlans) {
      const task = plan.tasks.find((t) => t.id === taskId);
      if (task) return task;
    }
    return null;
  },
};

// ==================== 统计服务 ====================

export const statsService = {
  getWeeklyStats(): {
    totalTasks: number;
    completedTasks: number;
    totalTime: number;
    actualTime: number;
    completionRate: number;
  } {
    const dailyPlans = planService.getDailyPlans(planService.getCurrentPlan()?.id || "");
    let totalTasks = 0;
    let completedTasks = 0;
    let totalTime = 0;
    let actualTime = 0;

    dailyPlans.forEach((day) => {
      totalTasks += day.tasks.length;
      totalTime += day.totalEstimatedTime;
      day.tasks.forEach((task) => {
        if (task.status === "completed") {
          completedTasks++;
          actualTime += task.feedback?.actualTime || task.estimatedTime;
        }
      });
    });

    return {
      totalTasks,
      completedTasks,
      totalTime,
      actualTime,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    };
  },
};
