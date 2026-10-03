/**
 * 访客数据迁移：登录成功后，把访客在三步问答中填写的答案
 * 交给当前用户的数据层，避免重复填写。
 *
 * 当前实现基于本地 Mock service 层（localStorage）：
 * - 创建/确认目标考试（examTargetService）；
 * - 写入每日可用时间与学段（authService.updateProfile）；
 * - 创建能力基线（materialService.saveBaseline）；
 * - 尝试自动加入匹配的公共资源并生成首个 7 天计划（PlanEngine 确定性规则）。
 *
 * 接入真实后端时的替换点：
 * 登录接口返回会话后，将 guestSessionService.load() 的答案一并提交到服务端，
 * 由服务端创建目标与基线；本文件的调用时机（登录成功后、预览页保存时）保持不变。
 */
import { AbilityBaseline, EvidenceItem, ExamTarget, ExamTargetInput } from "@/types";
import { authService } from "@/lib/auth";
import { examTargetService, materialService, planService, resourceService } from "@/lib/services";
import { STORAGE_KEYS, mockEvidenceItems } from "@/lib/mock-data";
import { loadFromStorage, saveToStorageStrict } from "@/lib/storage";
import { emitEvidenceChanged } from "@/lib/evidence/events";
import { PrepareStage, guestSessionService } from "./guestSession";
import { findMatchedTarget } from "./previewEngine";

export interface MigrationResult {
  targetId: string;
  /** 是否成功生成并确认了首个 7 天计划 */
  planReady: boolean;
}

function toInventoryStatus(stage: PrepareStage | undefined): AbilityBaseline["inventoryStatus"] {
  if (stage === "have_materials") return "single";
  if (stage === "too_many_materials") return "multiple";
  return "none";
}

/**
 * 把精确匹配到的种子目标的"官方确认"结论继承给用户的新目标，
 * 让保存下来的安排与首次结果页的"已核对"承诺一致。
 * 只继承 reviewStatus=official（人工/种子写入）；historical/personal/ai_extracted/
 * unconfirmed 一律不继承，避免它们在新目标上被误读为官方确认。
 */
function inheritSeedEvidence(newTarget: ExamTarget, seedTarget: ExamTarget | null): void {
  if (!seedTarget) return;
  const all = loadFromStorage<EvidenceItem[]>(STORAGE_KEYS.EVIDENCE_ITEMS, mockEvidenceItems);
  const officialItems = all.filter(
    (i) => i.examTargetId === seedTarget.id && i.reviewStatus === "official"
  );
  if (officialItems.length === 0) return;

  const now = new Date().toISOString();
  const copies = officialItems.map((i) => ({
    ...i,
    id: `ev-${i.field}-${newTarget.id}`,
    examTargetId: newTarget.id,
    updatedAt: now,
  }));
  saveToStorageStrict(STORAGE_KEYS.EVIDENCE_ITEMS, [...all, ...copies]);
  emitEvidenceChanged();
}

/**
 * 尝试为目标自动生成首个 7 天计划。
 * 学习内容来源：自动加入匹配的公共资源（官方/自制优先，每个模块取第 1 顺位）。
 * 仅当目标已被已核对考情支持（supported）时才自动生成；
 * 未支持的考试（如已归档的往年目标、无精确匹配）不生成 7 天计划，返回 false —— 不编造计划。
 */
function tryAutoPlan(target: ExamTarget, supported: boolean): boolean {
  if (!supported) return false;
  try {
    for (const moduleKey of ["mod_kebiao", "mod_zhenti", "mod_jiaoyuxue"]) {
      const top = resourceService.matchGap(moduleKey, target)[0];
      if (top) {
        resourceService.addToPlan(top.resource.id, target.id, moduleKey);
      }
    }
    const { weekly } = planService.generateDraft(target.id);
    planService.confirmPlan(weekly.id);
    return true;
  } catch {
    return false;
  }
}

/**
 * 执行迁移。幂等：成功后清除访客会话，重复调用返回 null（不会重复保存）。
 * 未登录、无访客会话或问答未完成时返回 null。
 */
export function migrateGuestSessionToUser(): MigrationResult | null {
  const user = authService.getSession()?.user;
  if (!user) return null;
  const guest = guestSessionService.load();
  if (!guest || guest.step < 3) return null;

  const { answers } = guest;

  // 0. 判定支持状态：必须在创建新目标之前计算（新目标是同维度确认态，会匹配到自身）。
  // 与首次结果页（previewEngine）一致：精确匹配 + 种子目标存在"考试科目/范围"的
  // 官方确认结论才算 supported；已归档往年目标、仅同省匹配一律 unsupported。
  const seedMatch = findMatchedTarget(answers, examTargetService.getAllRaw());
  const exactSeed = seedMatch?.level === "exact" ? seedMatch.target : null;
  const seedOfficial = loadFromStorage<EvidenceItem[]>(
    STORAGE_KEYS.EVIDENCE_ITEMS,
    mockEvidenceItems
  ).filter((i) => i.examTargetId === exactSeed?.id && i.reviewStatus === "official");
  const supported = seedOfficial.some(
    (i) => i.field === "subjects" || i.field === "exam_scope"
  );

  // 1. 创建目标考试：信息充分则确认，不足则保存草稿（澄清任务继续引导）
  const input: ExamTargetInput = {
    targetStatus: answers.announcementUrl
      ? "announcement"
      : answers.province
        ? "region"
        : "subject",
    province: answers.province,
    city: answers.city,
    recruiter: answers.recruiter,
    educationLevel: answers.educationLevel,
    announcementUrl: answers.announcementUrl,
    stage: "preparation",
  };

  let target: ExamTarget;
  try {
    target = examTargetService.confirmTarget(input);
  } catch {
    target = examTargetService.saveDraft(input);
  }

  // 2. 同步用户资料（学段、每日可用时间）
  authService.updateProfile({
    educationLevel: answers.educationLevel ?? user.educationLevel,
    dailyAvailableTime: answers.dailyAvailableMinutes ?? user.dailyAvailableTime,
  });

  // 3. 创建能力基线（首次体验的轻量版本，详细自评可在「我的考试」中随时补充）
  const dailyMinutes = answers.dailyAvailableMinutes ?? 60;
  const now = new Date().toISOString();
  materialService.saveBaseline({
    id: `ab-${target.id}`,
    userId: user.id,
    examTargetId: target.id,
    inventoryStatus: toInventoryStatus(answers.prepareStage),
    chineseAssessments: [],
    generalAssessments: [],
    recentScores: [],
    weakModules: [],
    dailyAvailableMinutes: dailyMinutes,
    weeklyAvailableHours: Math.round((dailyMinutes * 7) / 60),
    updatedAt: now,
  });

  // 4. 继承已核对考情；仅 supported 的目标自动生成首个 7 天计划（未支持不生成伪精确计划）
  inheritSeedEvidence(target, supported ? exactSeed : null);
  const planReady = tryAutoPlan(target, supported);

  // 5. 迁移完成，清除访客数据（防止重复保存）
  guestSessionService.clear();

  return { targetId: target.id, planReady };
}
