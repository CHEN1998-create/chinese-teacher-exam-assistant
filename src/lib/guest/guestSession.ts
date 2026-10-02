/**
 * 首次体验（访客）会话服务。
 *
 * 未登录用户可以完成三步问答并查看第一次结果；
 * 答案与进度保存在本机浏览器 localStorage（kb_guest_session），7 天过期。
 *
 * 注意：这不是真实认证或跨设备保存。
 * 接入真实后端时，访客数据应随登录一并提交到服务端（见 ./migrate.ts）。
 */
import { EducationLevel } from "@/types";
import { STORAGE_KEYS } from "@/lib/mock-data";
import { loadFromStorage, saveToStorage, removeFromStorage } from "@/lib/storage";

/** 第 3 步“你现在准备到哪一步”的选项 */
export type PrepareStage =
  | "not_started" // 还没开始
  | "have_materials" // 已有资料
  | "too_many_materials" // 资料太多，不知道怎么取舍
  | "cant_finish" // 经常完不成计划
  | "restarting"; // 再次备考

export const PREPARE_STAGE_LABELS: Record<PrepareStage, string> = {
  not_started: "还没开始",
  have_materials: "已有资料",
  too_many_materials: "资料太多，不知怎么取舍",
  cant_finish: "经常完不成计划",
  restarting: "再次备考",
};

/** 第 2 步“每天大约有多少时间”的选项（分钟） */
export const TIME_CHOICES: { label: string; minutes: number }[] = [
  { label: "30 分钟以内", minutes: 30 },
  { label: "1 小时左右", minutes: 60 },
  { label: "2 小时左右", minutes: 120 },
  { label: "3 小时以上", minutes: 180 },
];

export interface GuestAnswers {
  // 第 1 步：你想考哪里
  province?: string;
  city?: string;
  recruiter?: string;
  educationLevel?: EducationLevel;
  announcementUrl?: string;
  // 第 2 步：每天可用时间
  dailyAvailableMinutes?: number;
  // 第 3 步：准备阶段
  prepareStage?: PrepareStage;
}

export interface GuestSession {
  answers: GuestAnswers;
  /** 当前进行到哪一步（0-2 为问答中，3 为已完成问答可查看结果） */
  step: number;
  createdAt: string;
  updatedAt: string;
  /** 过期时间（ISO）：超过后视为无效，重新开始 */
  expiresAt: string;
}

/** 访客数据保留 7 天 */
const GUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isExpired(session: GuestSession): boolean {
  return Date.now() > Date.parse(session.expiresAt);
}

export const guestSessionService = {
  /** 读取访客会话；不存在或已过期时返回 null（过期会同时清除） */
  load(): GuestSession | null {
    const session = loadFromStorage<GuestSession | null>(STORAGE_KEYS.GUEST_SESSION, null);
    if (!session) return null;
    if (isExpired(session)) {
      removeFromStorage(STORAGE_KEYS.GUEST_SESSION);
      return null;
    }
    return session;
  },

  /** 创建或更新访客会话（答案自动保留，可返回修改） */
  save(patch: Partial<Pick<GuestSession, "answers" | "step">>): GuestSession {
    const existing = this.load();
    const now = new Date().toISOString();
    const next: GuestSession = {
      answers: { ...existing?.answers, ...patch.answers },
      step: patch.step ?? existing?.step ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      expiresAt: existing?.expiresAt ?? new Date(Date.now() + GUEST_TTL_MS).toISOString(),
    };
    saveToStorage(STORAGE_KEYS.GUEST_SESSION, next);
    return next;
  },

  /** 是否体验到一半（已开始但未完成问答） */
  isInProgress(): boolean {
    const s = this.load();
    return !!s && s.step > 0 && s.step < 3;
  },

  /** 是否已完成问答（可以查看首次结果） */
  isComplete(): boolean {
    const s = this.load();
    return !!s && s.step >= 3;
  },

  clear(): void {
    removeFromStorage(STORAGE_KEYS.GUEST_SESSION);
  },
};
