// ==================== 基础类型 ====================

export type ExamStatus = "draft" | "confirmed" | "archived";
export type ExamStage = "preparation" | "registration" | "written_exam" | "interview" | "completed";
export type ExamType = "public_school" | "private_school" | "public_institution" | "special_teacher" | "other";
export type EducationLevel = "primary" | "middle" | "high";
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

/**
 * 目标澄清的四种入口状态（跨层契约，存储值/UI/门禁共用，勿随意改名）：
 * - announcement：已有明确公告
 * - region：已确定地区但暂无公告
 * - candidates：有几个候选地区或学段
 * - subject：只确定语文学科
 */
export type TargetStatus = "announcement" | "region" | "candidates" | "subject";

/** 学科：当前固定语文，保留枚举以便未来扩展 */
export type SubjectType = "chinese";

/** 查找任务的类型，用于生成澄清任务与图标/文案 */
export type ClarificationTaskType =
  | "find_announcement"
  | "confirm_region"
  | "confirm_unit_or_batch"
  | "confirm_level"
  | "compare_candidates"
  | "other";

/** 候选地区/学段（candidates 入口使用） */
export interface TargetCandidate {
  id: string;
  province?: string;
  city?: string;
  educationLevel?: EducationLevel;
  note?: string;
}

/** 信息不足时生成的查找任务（每次目标最多 1-3 个） */
export interface ClarificationTask {
  id: string;
  title: string;
  description?: string;
  taskType: ClarificationTaskType;
  status: "pending" | "done";
  /** 时限提示，例如“本周内” */
  dueHint?: string;
  createdAt: string;
  completedAt?: string;
}

/** 已确定条件（澄清结果展示用） */
export interface ConfirmedCondition {
  label: string;
  value: string;
}

/** 目标信息不足时的澄清结果 */
export interface ClarificationResult {
  targetId: string;
  /** 已确定条件 */
  confirmedConditions: ConfirmedCondition[];
  /** 待确认问题 */
  pendingQuestions: string[];
  /** 1-3 个查找任务 */
  tasks: ClarificationTask[];
}

/** 创建/编辑目标时的输入数据（字段均可部分填写，以支持草稿与逐步澄清） */
export interface ExamTargetInput {
  targetStatus: TargetStatus;
  province?: string;
  city?: string;
  /** 招聘单位 */
  recruiter?: string;
  examType?: ExamType;
  year?: number;
  batch?: string;
  educationLevel?: EducationLevel;
  stage?: ExamStage;
  announcementUrl?: string;
  announcementFile?: string;
  candidates?: TargetCandidate[];
  /** 已确认为本周方向的候选 id（confirmCandidateDirection 内部使用） */
  confirmedCandidateId?: string;
}

export interface ExamTarget {
  id: string;
  userId: string;
  name: string;
  /** 地区展示串，由省份/城市/招聘单位派生，保持空串安全 */
  region: string;
  regionCode: string;
  /** 省份 */
  province?: string;
  /** 城市 */
  city?: string;
  /** 招聘单位（与城市至少填一个即可满足地区条件） */
  recruiter?: string;
  examType?: ExamType;
  educationLevel?: EducationLevel;
  /** 年份或批次：年份允许为空（信息不足时不臆造） */
  year?: number;
  batch?: string;
  /** 学科，固定语文 */
  subject: SubjectType;
  stage: ExamStage;
  /** 生命周期：draft 信息填写中/信息不足，confirmed 已确认主目标，archived 已归档 */
  status: ExamStatus;
  /** 四选一的澄清入口状态 */
  targetStatus: TargetStatus;
  isCurrent: boolean;
  announcementUrl?: string;
  announcementFile?: string;
  /** candidates 入口的候选列表 */
  candidates?: TargetCandidate[];
  /** 已确认为本周准备方向的候选 id */
  confirmedCandidateId?: string;
  /** 信息不足时生成的查找任务（随目标持久化，完成状态可保留） */
  clarificationTasks?: ClarificationTask[];
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

// ==================== 公告提取与考情证据 ====================

/** 结构化考试画像字段 */
export type EvidenceType =
  | "region" // 地区或招聘单位
  | "recruit_type" // 招聘类型
  | "year_batch" // 年份或批次
  | "education_level" // 学段
  | "exam_stage" // 考试阶段
  | "registration_time" // 报名时间（高影响）
  | "exam_time" // 考试时间（高影响）
  | "subjects" // 考试科目（高影响）
  | "score" // 分值（高影响）
  | "qualification" // 资格条件（高影响）
  | "exam_scope"; // 考试范围

/**
 * 审核状态。关键规则：
 * - AI 提取结论只能是 ai_extracted（AI已提取）或 pending_review（待审核）；
 * - official（官方确认）只能来自人工审核，本模块没有任何自动置为 official 的入口；
 * - 没有来源 / 来源冲突 / 字段缺失统一显示 unconfirmed（待确认）。
 */
export type ReviewStatus =
  | "ai_extracted"
  | "pending_review"
  | "official"
  | "historical"
  | "personal"
  | "unconfirmed";

/** 公告来源类型 */
export type EvidenceSourceType =
  | "announcement_url"
  | "announcement_text"
  | "announcement_file"
  | "historical"
  | "personal"
  | "seed";

/** 提取流程状态：未提交 / 正在提取 / 提取成功 / 提取失败 / 待人工审核 */
export type ExtractionJobStatus =
  | "idle"
  | "processing"
  | "succeeded"
  | "failed"
  | "pending_review";

/** 单条考情结论（字段级证据） */
export interface EvidenceItem {
  id: string;
  examTargetId: string;
  /** 结论对应的画像字段 */
  field: EvidenceType;
  /** 结论值；缺失时为空串，画像显示“待确认” */
  value: string;
  reviewStatus: ReviewStatus;
  /** 证据标签 / 来源名称，如“杭州市教育局官网” */
  sourceName: string;
  sourceType: EvidenceSourceType;
  sourceUrl?: string;
  /** 原始来源摘录（公告原文片段） */
  sourceExcerpt?: string;
  /** 适用范围，例如“浙江省杭州市 · 2026年上半年统招 · 初中语文” */
  scope: string;
  updatedAt: string;
  /** 官方确认时的审核信息（仅人工审核后存在） */
  reviewerName?: string;
  reviewedAt?: string;
  /** 多个来源结论不一致 */
  hasConflict?: boolean;
  /** 产出该结论的提取任务 id */
  jobId?: string;
  version: number;
}

/** 用户提交的公告来源 */
export interface AnnouncementSourceInput {
  sourceType: "announcement_url" | "announcement_text" | "announcement_file";
  url?: string;
  text?: string;
  fileName?: string;
  fileSize?: number;
}

/** 公告提取任务（异步流程） */
export interface ExtractionJob {
  id: string;
  examTargetId: string;
  userId: string;
  sourceType: AnnouncementSourceInput["sourceType"];
  /** 来源简述：链接 / 文件名 / 文本摘要 */
  sourceLabel: string;
  sourceUrl?: string;
  /** 粘贴文本全文（重试时复用；仅本地演示存储） */
  sourceText?: string;
  fileName?: string;
  fileSize?: number;
  status: ExtractionJobStatus;
  /** 0-100 */
  progress: number;
  /** 当前阶段文案，如“正在识别考试科目与分值” */
  stage?: string;
  /** 失败原因（status=failed 时） */
  failReason?: string;
  /** 提取到的字段数 */
  extractedCount?: number;
  /** 其中待人工审核的高影响字段数 */
  pendingReviewCount?: number;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
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
  /** 字段中文名，便于审核队列展示 */
  fieldLabel?: string;
  currentValue: string;
  suggestedValue: string;
  reason: string;
  /** 用户提供的佐证链接 */
  sourceUrl?: string;
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

/** 四种目标澄清入口的文案（存储值到展示文案的唯一映射） */
export const TARGET_STATUS_LABELS: Record<TargetStatus, string> = {
  announcement: "已有明确公告",
  region: "已确定地区·暂无公告",
  candidates: "候选地区/学段",
  subject: "只确定语文学科",
};

export const SUBJECT_LABELS: Record<SubjectType, string> = {
  chinese: "语文",
};

/** 目标生命周期状态文案 */
export const TARGET_LIFECYCLE_LABELS: Record<ExamStatus, string> = {
  draft: "澄清中",
  confirmed: "已确认",
  archived: "已归档",
};

/** 画像字段中文名 */
export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  region: "地区/招聘单位",
  recruit_type: "招聘类型",
  year_batch: "年份/批次",
  education_level: "学段",
  exam_stage: "考试阶段",
  registration_time: "报名时间",
  exam_time: "考试时间",
  subjects: "考试科目",
  score: "分值",
  qualification: "资格条件",
  exam_scope: "考试范围",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  ai_extracted: "AI已提取",
  pending_review: "待审核",
  official: "官方确认",
  historical: "历史经验",
  personal: "个人经验",
  unconfirmed: "待确认",
};

export const EXTRACTION_JOB_STATUS_LABELS: Record<ExtractionJobStatus, string> = {
  idle: "未提交",
  processing: "正在提取",
  succeeded: "提取成功",
  failed: "提取失败",
  pending_review: "待人工审核",
};

export const EVIDENCE_SOURCE_TYPE_LABELS: Record<EvidenceSourceType, string> = {
  announcement_url: "公告链接",
  announcement_text: "粘贴文本",
  announcement_file: "公告文件",
  historical: "历史经验",
  personal: "个人经验",
  seed: "预置数据",
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
