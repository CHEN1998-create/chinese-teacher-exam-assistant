// ==================== 基础类型 ====================

export type ExamStatus = "draft" | "confirmed" | "archived";
export type ExamStage = "preparation" | "registration" | "written_exam" | "interview" | "completed";
export type ExamType = "public_school" | "private_school" | "public_institution" | "special_teacher" | "other";
export type EducationLevel = "primary" | "middle" | "high";
export type EvidenceLevel = "official" | "historical" | "personal" | "pending";
export type MaterialStatus = "in_use" | "partial_use" | "paused" | "replaced";
export type ResourceType = "official" | "self_made" | "open" | "third_party";
export type TaskStatus = "pending" | "in_progress" | "completed" | "partial" | "abandoned";
export type FeedbackStatus = "pending" | "submitted" | "reviewed";
export type UserRole = "user" | "exam_reviewer" | "resource_reviewer" | "admin";

// ==================== 用户相关 ====================

export interface User {
  id: string;
  name: string;
  avatar?: string;
  role: UserRole;
  educationLevel?: EducationLevel;
  dailyAvailableTime: number; // 每日可用时间（分钟）
  studyReminderTime?: string; // 每日学习提醒时间，例如 "08:00"
  notificationSettings: NotificationSettings;
  currentExamTargetId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSettings {
  studyReminder: boolean;
  examUpdate: boolean;
  resourceUpdate: boolean;
  weeklyReport: boolean;
}

export interface UserSettings {
  educationLevel?: EducationLevel;
  dailyAvailableTime: number;
  studyReminderTime?: string;
  notifications: NotificationSettings;
}

// ==================== 目标考试 ====================

export interface ExamTarget {
  id: string;
  userId: string;
  name: string;
  region: string;
  regionCode: string;
  examType: ExamType;
  educationLevel: EducationLevel;
  year: number;
  batch?: string;
  stage: ExamStage;
  status: ExamStatus;
  isCurrent: boolean;
  announcementUrl?: string;
  announcementFile?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExamTargetFormData {
  region: string;
  examType: ExamType;
  educationLevel: EducationLevel;
  year?: number;
  batch?: string;
  announcementUrl?: string;
}

// ==================== 证据与考情 ====================

export interface Evidence {
  id: string;
  examTargetId: string;
  field: string;
  value: string;
  source: string;
  sourceUrl?: string;
  level: EvidenceLevel;
  verifiedBy?: string;
  verifiedAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceCard {
  id: string;
  examTargetId: string;
  title: string;
  content: string;
  category: "exam_scope" | "subjects" | "qualification" | "schedule" | "other";
  level: EvidenceLevel;
  source: string;
  sourceUrl?: string;
  lastVerifiedAt: string;
  notes?: string;
}

export interface ExamInfoItem {
  field: string;
  label: string;
  value?: string;
  evidence?: Evidence;
  isPending: boolean;
}

// ==================== 用户资料 ====================

export interface UserMaterial {
  id: string;
  userId: string;
  examTargetId: string;
  name: string;
  author?: string;
  publisher?: string;
  year?: number;
  chapters: Chapter[];
  currentChapterId?: string;
  progress: number; // 0-100
  status: MaterialStatus;
  diagnosis?: MaterialDiagnosis;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  materialId: string;
  title: string;
  order: number;
  isCompleted: boolean;
  completedAt?: string;
}

export interface MaterialDiagnosis {
  id: string;
  materialId: string;
  recommendation: "continue" | "partial" | "pause" | "replace";
  reason: string;
  suggestedChapters?: string[];
  missingModules: string[];
  alternativeResources?: string[];
  diagnosedAt: string;
}

// ==================== 公共资源 ====================

export interface PublicResource {
  id: string;
  title: string;
  description: string;
  type: ResourceType;
  source: string;
  sourceUrl: string;
  license: "free" | "paid" | "open" | "restricted" | "unknown";
  applicableRegions: string[];
  applicableTypes: ExamType[];
  applicableLevels: EducationLevel[];
  modules: string[];
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceMatch {
  resource: PublicResource;
  matchScore: number;
  matchReason: string;
  suggestedChapters?: string[];
  estimatedTime?: number;
}

// ==================== 计划与任务 ====================

export interface WeeklyPlan {
  id: string;
  userId: string;
  examTargetId: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  focus: string;
  status: "draft" | "active" | "completed" | "abandoned";
  version: number;
  previousVersionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyPlan {
  id: string;
  weeklyPlanId: string;
  date: string;
  dayOfWeek: number;
  tasks: PlanTask[];
  totalEstimatedTime: number;
  isMinimumViable: boolean;
  adjustmentNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanTask {
  id: string;
  dailyPlanId: string;
  title: string;
  module: string;
  materialId?: string;
  materialChapterId?: string;
  estimatedTime: number;
  completionCriteria: string;
  order: number;
  status: TaskStatus;
  isCore: boolean;
  feedback?: TaskFeedback;
  createdAt: string;
  updatedAt: string;
}

export interface PlanAdjustment {
  id: string;
  weeklyPlanId: string;
  type: "replan" | "reduce" | "postpone" | "replace" | "abandon";
  reason: string;
  affectedTaskIds: string[];
  notes?: string;
  createdAt: string;
}

// ==================== 执行反馈 ====================

export interface TaskFeedback {
  id: string;
  taskId: string;
  userId: string;
  status: "completed" | "partial" | "not_completed";
  actualTime?: number;
  incompleteReason?: "time" | "difficulty" | "material" | "mood" | "other";
  errorTypes: ErrorType[];
  hasSecondPractice: boolean;
  notes?: string;
  createdAt: string;
}

export type ErrorType = 
  | "knowledge_gap" 
  | "misunderstanding" 
  | "structure_unclear" 
  | "time_management" 
  | "careless" 
  | "material_unsuitable"
  | "other";

export interface DailyFeedback {
  id: string;
  dailyPlanId: string;
  userId: string;
  overallCompletion: number; // 0-100
  summary?: string;
  blockers?: string;
  tomorrowSuggestions?: string;
  createdAt: string;
}

// ==================== 审核与纠错 ====================

export interface Review {
  id: string;
  type: "exam_evidence" | "resource" | "feedback";
  targetId: string;
  riskLevel: "high" | "medium" | "low";
  status: "pending" | "approved" | "rejected" | "withdrawn";
  reviewerId?: string;
  reviewNotes?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface Correction {
  id: string;
  userId: string;
  examTargetId: string;
  field: string;
  currentValue: string;
  suggestedValue: string;
  reason: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

// ==================== UI 状态 ====================

export interface LoadingState {
  isLoading: boolean;
  error?: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==================== 常量映射 ====================

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  user: "备考用户",
  exam_reviewer: "考情审核员",
  resource_reviewer: "资源审核员",
  admin: "管理员",
};

/** 可以进入运营后台的角色 */
export const STAFF_ROLES: UserRole[] = ["exam_reviewer", "resource_reviewer", "admin"];

export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  primary: "小学",
  middle: "初中",
  high: "高中",
};

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  public_school: "公办学校招聘",
  private_school: "民办学校招聘",
  public_institution: "事业单位招聘",
  special_teacher: "特岗教师",
  other: "其他",
};

export const EXAM_STAGE_LABELS: Record<ExamStage, string> = {
  preparation: "备考中",
  registration: "报名阶段",
  written_exam: "笔试阶段",
  interview: "面试阶段",
  completed: "已完成",
};

export const EVIDENCE_LEVEL_LABELS: Record<EvidenceLevel, string> = {
  official: "官方确认",
  historical: "历史经验",
  personal: "个人经验",
  pending: "待确认",
};

export const MATERIAL_STATUS_LABELS: Record<MaterialStatus, string> = {
  in_use: "继续使用",
  partial_use: "部分使用",
  paused: "本周暂缓",
  replaced: "已更换",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "待开始",
  in_progress: "进行中",
  completed: "已完成",
  partial: "部分完成",
  abandoned: "已放弃",
};

export const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  knowledge_gap: "知识点不会",
  misunderstanding: "理解错误",
  structure_unclear: "答题结构不清",
  time_management: "时间不够",
  careless: "粗心",
  material_unsuitable: "资料不适合",
  other: "其他",
};

export const FEEDBACK_INCOMPLETE_REASONS: Record<string, string> = {
  time: "时间不够",
  difficulty: "内容太难",
  material: "资料不合适",
  mood: "状态不好",
  other: "其他",
};
