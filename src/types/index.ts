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
  /** 多个来源结论不一致（由画像层根据当前事实结论计算） */
  hasConflict?: boolean;
  /** 审核员手动标记“来源冲突”（即使只有单一来源也保留该标记，驳回后清除） */
  reviewerFlaggedConflict?: boolean;
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

// ==================== 考情审核后台 ====================

/**
 * 审核动作（跨层契约，存储值/UI/留痕共用，勿随意改名）：
 * - approve：通过（值不变，置为官方确认）
 * - approve_with_edit：修改后通过（校正值后置为官方确认，已发布结论须升版本）
 * - reject：驳回（结论不成立，用户端显示待确认，原值保留留痕）
 * - mark_unconfirmed：标记待确认（保留结论但暂不确认）
 * - mark_conflict：标记来源冲突（不静默覆盖，用户端显示待确认/冲突）
 */
export type ReviewActionType =
  | "approve"
  | "approve_with_edit"
  | "reject"
  | "mark_unconfirmed"
  | "mark_conflict";

/** 审核队列视图 */
export type ReviewQueueKey =
  | "pending" // 待审核
  | "high_risk" // 高风险优先
  | "conflict" // 来源冲突
  | "expiring" // 即将过期
  | "completed"; // 已完成

/**
 * 审核留痕记录：每次审核动作不可变地追加一条。
 * 保存审核人、审核时间、动作、原因、修改前后内容与状态、版本号。
 */
export interface ReviewLog {
  id: string;
  evidenceItemId: string;
  examTargetId: string;
  field: EvidenceType;
  action: ReviewActionType;
  /** 审核前的值（修改后通过时与 afterValue 不同） */
  beforeValue: string;
  /** 审核后的值 */
  afterValue: string;
  beforeStatus: ReviewStatus;
  afterStatus: ReviewStatus;
  /** 操作后该结论的版本号 */
  version: number;
  /** 必填原因（预置原因 + 补充说明） */
  reason: string;
  /** 预置原因（便于后续统计） */
  reasonPreset?: string;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: UserRole;
  reviewedAt: string;
}

// ==================== 资料与能力基线 ====================

/**
 * 资料状态入口（跨层契约，存储值/UI 共用，勿随意改名）：
 * - none：还没有资料
 * - single：已有一套资料
 * - multiple：有多套资料，不知道如何取舍
 */
export type UsageStatus = "none" | "single" | "multiple";

/** 资料来源类型；unknown_scan 为来源不明的完整扫描件（疑似盗版），不能进入公共资源 */
export type MaterialSourceType =
  | "published" // 正版教材/公开出版物
  | "institution" // 培训机构内部资料
  | "self_notes" // 个人笔记/自编资料
  | "open_web" // 公开免费网络资料
  | "unknown_scan" // 来源不明的完整扫描件
  | "other";

/** 资料诊断结论（模块级与资料整体共用） */
export type MaterialRecommendation = "continue" | "partial" | "pause";

export interface Chapter {
  id: string;
  materialId: string;
  title: string;
  order: number;
  isCompleted: boolean;
  completedAt?: string;
}

/** 用户私有备考资料（与公共资源 PublicResource 严格分开） */
export interface MaterialItem {
  id: string;
  userId: string;
  examTargetId: string;
  name: string;
  sourceType: MaterialSourceType;
  author?: string;
  publisher?: string;
  /** 适用地区文本，如“全国”“浙江省”“杭州市” */
  applicableRegion: string;
  year?: number;
  /** 适用学段；unknown 表示未标注 */
  applicableLevel?: EducationLevel | "unknown";
  /** 用户确认覆盖的考试模块 key（来自模块目录，可手动修改） */
  coversModules: string[];
  /** 目录或章节（允许手动维护，不依赖 PDF 解析） */
  chapters: Chapter[];
  /** 用户是否已核对目录（识别不确定时可手动修改章节） */
  catalogConfirmed: boolean;
  /** 学习进度 0-100 */
  progress: number;
  /** 用户备注 */
  note?: string;
  createdAt: string;
  updatedAt: string;

  /** @deprecated 旧版资料状态，保留仅为兼容旧数据与 MaterialCard */
  status?: MaterialStatus;
  /** @deprecated 旧版内嵌诊断；新诊断持久化在 MaterialDiagnosisSnapshot 中 */
  diagnosis?: MaterialDiagnosis;
}

/** @deprecated 旧名称，新代码统一使用 MaterialItem */
export type UserMaterial = MaterialItem;

/** 模块自评等级：1 很薄弱 → 5 很扎实 */
export type SelfAssessmentLevel = 1 | 2 | 3 | 4 | 5;

export interface ModuleSelfAssessment {
  /** 模块目录 key */
  module: string;
  level: SelfAssessmentLevel;
  note?: string;
}

/** 最近练习成绩 */
export interface PracticeScore {
  id: string;
  /** 模块目录 key */
  module: string;
  /** 原始成绩描述，如“72/100”“85分” */
  scoreText: string;
  /** 百分制折算值（0-100），用于薄弱项规则，可空 */
  scorePercent?: number;
  /** 考试日期 YYYY-MM-DD */
  takenAt?: string;
  note?: string;
}

/** 能力基线：每个用户 + 每个目标考试一份 */
export interface AbilityBaseline {
  id: string;
  userId: string;
  examTargetId: string;
  /** 资料状态入口三选一 */
  inventoryStatus: UsageStatus;
  /** 语文学科模块自评 */
  chineseAssessments: ModuleSelfAssessment[];
  /** 教综或其他考试模块自评 */
  generalAssessments: ModuleSelfAssessment[];
  recentScores: PracticeScore[];
  /** 明显薄弱项（模块 key 或用户自填文本） */
  weakModules: string[];
  /** 每日可用时间（分钟） */
  dailyAvailableMinutes: number;
  /** 每周可用时间（小时） */
  weeklyAvailableHours: number;
  updatedAt: string;
}

/** 单份资料 × 单个考试模块的诊断结论 */
export interface MaterialDiagnosisItem {
  module: string;
  moduleLabel: string;
  recommendation: MaterialRecommendation;
  reason: string;
  relatedChapterTitles: string[];
}

/** 单份资料的诊断结果 */
export interface MaterialDiagnosis {
  id: string;
  materialId: string;
  examTargetId: string;
  recommendation: MaterialRecommendation;
  reason: string;
  /** 逐考试模块的结论与原因 */
  items: MaterialDiagnosisItem[];
  /** partial 时建议使用的章节标题 */
  suggestedChapterTitles: string[];
  coversModules: string[];
  /** 该资料未覆盖但考试需要的模块 key */
  missingModules: string[];
  /** 风险提示（来源不明扫描件、地区/年份不符等） */
  warnings: string[];
  diagnosedAt: string;
}

/** 多套资料覆盖同一模块时的取舍说明 */
export interface MaterialConflictGroup {
  module: string;
  moduleLabel: string;
  /** 建议保留的资料 id */
  keepMaterialId: string;
  /** 建议本周暂缓的资料及原因 */
  paused: { materialId: string; reason: string }[];
  advice: string;
}

/** 每个目标一份的诊断快照（含输入签名，用于“切换/变更后提示重新计算”） */
export interface MaterialDiagnosisSnapshot {
  examTargetId: string;
  /** 生成快照时的输入签名 */
  signature: string;
  /** 高影响考情是否已全部官方确认 */
  evidenceComplete: boolean;
  /** 诊断时仍未官方确认的高影响字段 */
  pendingEvidenceFields: EvidenceType[];
  materialDiagnoses: MaterialDiagnosis[];
  /** 全部资料合并后仍缺少的模块 key */
  missingModules: string[];
  conflictGroups: MaterialConflictGroup[];
  /** 规则计算出的薄弱模块 key */
  weakModules: string[];
  diagnosedAt: string;
}

// ==================== 公共资源索引 ====================

/**
 * 权利状态（资源被推荐前必须明确）：
 * - official 官方公告/大纲/样题/说明（政府或招考部门发布）
 * - self_made 平台自制内容
 * - licensed 已获授权内容
 * - open 明确开放使用的内容
 * - third_party 第三方公开资源：仅索引原始链接与必要摘要，不复制全文
 * - unknown 权利状态不明：不能强推荐
 */
export type RightsStatus = "official" | "self_made" | "licensed" | "open" | "third_party" | "unknown";

/**
 * 资源生命周期状态：
 * - active 正常；inactive 已停用（不再产生新推荐）；
 * - expired 已失效（过了失效时间或链接已失效）；pending_review 待复核。
 */
export type ResourceStatus = "active" | "inactive" | "expired" | "pending_review";

export interface ResourceItem {
  id: string;
  /** 名称 */
  title: string;
  /** 简介说明（必要摘要，第三方资源不复制全文） */
  description?: string;
  /** 资源类型（官方/自制/开放/第三方） */
  resourceType: ResourceType;
  /** 原始来源名称 */
  sourceName: string;
  /** 原始来源链接 */
  sourceUrl: string;
  /** 权利状态 */
  rightsStatus: RightsStatus;
  /** 适用地区，如 ["全国"] / ["浙江省"] / ["浙江省","杭州市"] */
  applicableRegions: string[];
  /** 适用年份；缺省表示长期有效（如课程标准） */
  year?: number;
  /** 适用学段 */
  applicableLevels: EducationLevel[];
  /** 适用招聘类型 */
  applicableTypes: ExamType[];
  /** 对应考试模块 key（mod_*，与资料诊断同一模块目录） */
  modules: string[];
  /** 推荐理由（后台维护，向用户明示） */
  recommendReason: string;
  /** 建议章节/用法 */
  suggestedChapters: string[];
  /** 预计使用时间（分钟） */
  estimatedMinutes: number;
  /** 最近复核时间 */
  lastReviewedAt: string;
  /** 失效时间；缺省表示长期有效 */
  expiresAt?: string;
  /** 链接最近检查时间 */
  linkCheckedAt?: string;
  /** 链接是否可访问 */
  linkAlive: boolean;
  /** 生命周期状态 */
  status: ResourceStatus;
  /** 复核人 */
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
}

/** @deprecated 旧名，保留一个版本周期用于兼容；新代码请用 ResourceItem */
export type PublicResource = ResourceItem;

/** 单个缺口的一条匹配结果（最多 3 条，排序即优先级） */
export interface ResourceMatch {
  resource: ResourceItem;
  /** 对应的缺口模块 key */
  module: string;
  /** 1=最高优先级（官方）→4（第三方公开索引） */
  tier: number;
  /** 1-3 名 */
  rank: number;
  /** 打分（仅用于同缺口下确定性排序，不做商业排行） */
  matchScore: number;
  /** 面向用户的推荐理由（含来源层级与适用范围） */
  matchReason: string;
  /** 适用范围摘要（地区/年份/学段/招聘类型） */
  scopeSummary: string;
}

/** 资源加入计划后的状态：待安排 → 已安排 → 使用中 → 已使用；可放弃 */
export type ResourceLinkStatus =
  | "pending_arrangement"
  | "arranged"
  | "in_use"
  | "used"
  | "dismissed";

/** “加入本周计划”生成的待安排任务数据（不与每日任务混用） */
export interface ResourcePlanLink {
  id: string;
  userId: string;
  resourceId: string;
  examTargetId: string;
  /** 缺口模块 key */
  module: string;
  status: ResourceLinkStatus;
  estimatedMinutes: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/** 资源查看记录（点击查看来源时写入） */
export interface ResourceViewRecord {
  id: string;
  userId: string;
  resourceId: string;
  viewedAt: string;
}

/** 后台资源队列 key */
export type ResourceQueueKey = "all" | "active" | "pending_review" | "expired" | "inactive";

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

/** 审核队列文案 */
export const REVIEW_QUEUE_LABELS: Record<ReviewQueueKey, string> = {
  pending: "待审核",
  high_risk: "高风险优先",
  conflict: "来源冲突",
  expiring: "即将过期",
  completed: "已完成",
};

/** 审核动作文案 */
export const REVIEW_ACTION_LABELS: Record<ReviewActionType, string> = {
  approve: "通过",
  approve_with_edit: "修改后通过",
  reject: "驳回",
  mark_unconfirmed: "标记待确认",
  mark_conflict: "标记来源冲突",
};

/**
 * 各审核动作的必填预置原因（操作时必须选择一项，可再补充说明）。
 * 不允许“无原因”的审核动作。
 */
export const REVIEW_REASON_PRESETS: Record<ReviewActionType, string[]> = {
  approve: ["与公告原文一致", "来源为官方渠道（教育局/人社局官网）", "与历年公告及现有信息一致"],
  approve_with_edit: ["AI 识别有误，已按公告原文校正", "公告信息有遗漏，已补充完整", "格式/表述不规范，已规范化"],
  reject: ["公告原文中没有该信息", "来源不可靠，无法证实", "与官方公告结论矛盾", "属于猜测或推断，不是公告事实"],
  mark_unconfirmed: ["新公告尚未发布，暂无权威来源", "公告信息不完整，待后续补充公告", "多个来源暂无法核实，先保留待确认"],
  mark_conflict: ["不同来源给出的结论不一致", "新旧公告表述冲突", "来源转载矛盾，需向发布单位核实"],
};

export const MATERIAL_STATUS_LABELS: Record<MaterialStatus, string> = {
  in_use: "继续使用",
  partial_use: "部分使用",
  paused: "本周暂缓",
  replaced: "已更换",
};

/** 资料状态入口文案 */
export const USAGE_STATUS_LABELS: Record<UsageStatus, string> = {
  none: "还没有资料",
  single: "已有一套资料",
  multiple: "有多套资料，不知道如何取舍",
};

/** 资料来源类型文案 */
export const MATERIAL_SOURCE_TYPE_LABELS: Record<MaterialSourceType, string> = {
  published: "正版教材/公开出版物",
  institution: "培训机构内部资料",
  self_notes: "个人笔记/自编资料",
  open_web: "公开免费网络资料",
  unknown_scan: "来源不明的完整扫描件",
  other: "其他",
};

/** 资料诊断结论文案 */
export const MATERIAL_RECOMMENDATION_LABELS: Record<MaterialRecommendation, string> = {
  continue: "继续使用",
  partial: "只使用部分章节",
  pause: "本周暂不使用",
};

/** 模块自评等级文案：1 很薄弱 → 5 很扎实 */
export const SELF_ASSESSMENT_LEVEL_LABELS: Record<SelfAssessmentLevel, string> = {
  1: "很薄弱",
  2: "较薄弱",
  3: "一般",
  4: "较扎实",
  5: "很扎实",
};

/** 资源类型文案（与 ResourceType 对应） */
export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  official: "官方发布",
  self_made: "平台自制",
  open: "开放使用",
  third_party: "第三方公开",
};

/** 权利状态文案 */
export const RIGHTS_STATUS_LABELS: Record<RightsStatus, string> = {
  official: "官方文件",
  self_made: "平台自制",
  licensed: "已授权",
  open: "开放授权",
  third_party: "第三方公开·仅索引",
  unknown: "权利状态不明",
};

/** 资源生命周期状态文案 */
export const RESOURCE_STATUS_LABELS: Record<ResourceStatus, string> = {
  active: "正常",
  inactive: "已停用",
  expired: "已失效",
  pending_review: "待复核",
};

/** 资源加入计划后的状态文案 */
export const RESOURCE_LINK_STATUS_LABELS: Record<ResourceLinkStatus, string> = {
  pending_arrangement: "待安排",
  arranged: "已排入计划",
  in_use: "使用中",
  used: "已使用",
  dismissed: "已放弃",
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
