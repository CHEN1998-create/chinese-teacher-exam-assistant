/**
 * 集成测试（jsdom + localStorage Mock 服务层）：
 * - 刷新后访客首次填写内容不丢失；
 * - 登录迁移后考试信息保留，用户不被要求重新填写；
 * - 重复提交反馈被拦截，只能修改已有反馈。
 */
import { describe, it, expect, beforeEach } from "vitest";
import { DailyPlan, PlanTask, WeeklyPlan } from "@/types";
import { STORAGE_KEYS } from "@/lib/mock-data";
import { loadFromStorage, saveToStorageStrict } from "@/lib/storage";
import { authService } from "@/lib/auth";
import { evidenceService, examTargetService, feedbackService } from "@/lib/services";
import { guestSessionService } from "./guestSession";
import { migrateGuestSessionToUser } from "./migrate";
import { DuplicateFeedbackError } from "@/lib/plans/feedbackService";

const ANSWERS = {
  province: "浙江省",
  city: "杭州市",
  educationLevel: "middle" as const,
  dailyAvailableMinutes: 45,
  prepareStage: "not_started" as const,
};

function seedWeeklyPlan(): { weekly: WeeklyPlan; task: PlanTask } {
  const ts = "2026-03-01T20:00:00.000Z";
  const task: PlanTask = {
    id: "t-seed-1",
    dailyPlanId: "d-seed-1",
    title: "课程标准学习",
    module: "mod_kebiao",
    sourceType: "resource",
    resourceId: "r-1",
    estimatedTime: 40,
    completionCriteria: "复述课程理念",
    arrangementReason: "先打底",
    reviewAction: "合上书本默写要点",
    order: 1,
    status: "pending",
    priority: "medium",
    isCore: true,
    createdAt: ts,
    updatedAt: ts,
  };
  const daily: DailyPlan = {
    id: "d-seed-1",
    weeklyPlanId: "wp-seed",
    date: "2026-03-02",
    dayOfWeek: 1,
    tasks: [task],
    totalEstimatedTime: 40,
    isMinimumViable: true,
    availableMinutes: 45,
    createdAt: ts,
    updatedAt: ts,
  };
  const weekly: WeeklyPlan = {
    id: "wp-seed",
    userId: "u-001",
    examTargetId: "et-001",
    weekNumber: 1,
    startDate: "2026-03-02",
    endDate: "2026-03-08",
    focus: "课标",
    status: "active",
    version: 1,
    generationReason: "种子计划",
    createdAt: ts,
    updatedAt: ts,
  };
  saveToStorageStrict(STORAGE_KEYS.PLANS, [weekly]);
  saveToStorageStrict(STORAGE_KEYS.DAILY_PLANS, [daily]);
  return { weekly, task };
}

beforeEach(async () => {
  localStorage.clear();
  await authService.logout().catch(() => undefined);
});

describe("访客首次填写内容", () => {
  it("保存后重新加载（模拟刷新）：地区/学段/时间完整保留", () => {
    guestSessionService.save({ answers: ANSWERS, step: 3 });

    // 重新从 localStorage 读取，模拟页面刷新后的无状态加载
    const restored = guestSessionService.load();
    expect(restored).not.toBeNull();
    expect(restored!.answers.province).toBe("浙江省");
    expect(restored!.answers.city).toBe("杭州市");
    expect(restored!.answers.educationLevel).toBe("middle");
    expect(restored!.answers.dailyAvailableMinutes).toBe(45);
    expect(restored!.step).toBe(3);
  });

  it("分步保存时前序答案不被覆盖", () => {
    guestSessionService.save({
      answers: { province: "浙江省", city: "杭州市" },
      step: 1,
    });
    guestSessionService.save({
      answers: { dailyAvailableMinutes: 30 },
      step: 2,
    });
    const s = guestSessionService.load();
    expect(s!.answers.province).toBe("浙江省");
    expect(s!.answers.dailyAvailableMinutes).toBe(30);
  });
});

describe("登录保存后不落入空白状态", () => {
  it("迁移后考试信息与可用时间进入账号，访客记录清除（幂等）", async () => {
    guestSessionService.save({ answers: ANSWERS, step: 3 });
    await authService.login({
      account: "student@demo.app",
      password: "demo1234",
    });

    const result = migrateGuestSessionToUser();
    expect(result).not.toBeNull();
    expect(typeof result!.planReady).toBe("boolean");

    // 用户的考试目标仍带着首次填写的地区与学段，不要求重填
    const current = examTargetService.getCurrent();
    expect(current).not.toBeNull();
    expect(current!.province).toBe("浙江省");
    expect(current!.city).toBe("杭州市");
    expect(current!.educationLevel).toBe("middle");

    // 可用时间同步到账号资料
    expect(authService.getSession()!.user.dailyAvailableTime).toBe(45);

    // 访客会话已清除，再次迁移返回 null，不会重复保存
    expect(guestSessionService.load()).toBeNull();
    expect(migrateGuestSessionToUser()).toBeNull();
  });

  it("未登录时不迁移", () => {
    guestSessionService.save({ answers: ANSWERS, step: 3 });
    expect(migrateGuestSessionToUser()).toBeNull();
  });
});

describe("未支持的考试不生成伪精确计划", () => {
  it("已核对支持的目标：迁移后生成 active 计划，并继承官方结论", async () => {
    guestSessionService.save({ answers: ANSWERS, step: 3 });
    await authService.login({ account: "student@demo.app", password: "demo1234" });

    const migration = migrateGuestSessionToUser();
    expect(migration).not.toBeNull();
    expect(migration!.planReady).toBe(true);

    const plans = loadFromStorage<WeeklyPlan[]>(STORAGE_KEYS.PLANS, []);
    const active = plans.filter((p) => p.status === "active");
    expect(active).toHaveLength(1);
    expect(active[0].examTargetId).toBe(migration!.targetId);

    // 官方结论随目标继承，"已核对"承诺在登录后仍成立
    const items = evidenceService.getItems(migration!.targetId);
    expect(items.some((i) => i.reviewStatus === "official")).toBe(true);
  });

  it("已归档往年目标（南京高中）：迁移后不生成计划、不继承为官方确认", async () => {
    guestSessionService.save({
      answers: {
        province: "江苏省",
        city: "南京市",
        educationLevel: "high" as const,
        dailyAvailableMinutes: 60,
        prepareStage: "not_started" as const,
      },
      step: 3,
    });
    await authService.login({ account: "student@demo.app", password: "demo1234" });

    const migration = migrateGuestSessionToUser();
    expect(migration).not.toBeNull();
    expect(migration!.planReady).toBe(false);
    expect(loadFromStorage<WeeklyPlan[]>(STORAGE_KEYS.PLANS, [])).toHaveLength(0);
    expect(evidenceService.getItems(migration!.targetId)).toHaveLength(0);
  });
});

describe("重复提交反馈", () => {
  it("同一任务第二次提交抛 DuplicateFeedbackError，已有反馈可修改", async () => {
    await authService.login({
      account: "student@demo.app",
      password: "demo1234",
    });
    const { task } = seedWeeklyPlan();

    feedbackService.submit(task.id, {
      status: "not_completed",
      incompleteReason: "time",
      errorTypes: [],
      hasSecondPractice: false,
    });

    expect(() =>
      feedbackService.submit(task.id, {
        status: "completed",
        errorTypes: [],
        hasSecondPractice: false,
      })
    ).toThrow(DuplicateFeedbackError);

    // 只能修改已有反馈：状态变更成功
    const existing = feedbackService.getByTask(task.id)!;
    const updated = feedbackService.update(existing.id, {
      status: "partial",
      actualTime: 20,
      incompleteReason: "time",
      errorTypes: [],
      hasSecondPractice: false,
    });
    expect(updated.status).toBe("partial");
    expect(updated.createdAt).toBe(existing.createdAt);
  });
});
