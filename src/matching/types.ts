/**
 * v6.1 资格匹配领域类型（后端，模块 5）。
 *
 * 与前端模块 1 的 lib/announcements/types、lib/matching/types、lib/profile/types
 * 保持同一套 JSON 结构：匹配规则只在后端实现，前端只消费结果（PRD 7.4：
 * “后端返回逐条件结果、规则版本、公告版本和 EvidenceAnchor；前端不自行复制判断逻辑”）。
 *
 * 本文件只定义类型，不含存储与框架代码；纯规则见 engine.ts。
 */

// ==================== 公告与报考单元 ====================

export type SubjectCode = string;
export type StageCode = 'primary' | 'middle' | 'high' | (string & {});

export const OPEN_SUBJECTS = ['chinese'] as const;

export type EmploymentNatureCode =
  | 'public_institution_staff'
  | 'record_filing'
  | 'post_quota'
  | 'headcount_control'
  | 'other';

export const IN_SCOPE_EMPLOYMENT_NATURES: readonly EmploymentNatureCode[] = [
  'public_institution_staff',
  'record_filing',
  'post_quota',
  'headcount_control',
  'other',
];

export interface EmploymentNature {
  code: EmploymentNatureCode;
  /** 公告中的官方名称 */
  officialName: string;
}

export type AllocationMethodCode =
  | 'direct_school'
  | 'score_based_choice'
  | 'unified_assignment'
  | 'other';

export interface AllocationMethod {
  code: AllocationMethodCode;
  description: string;
}

export interface RegionRef {
  code: string;
  province: string;
  city?: string;
  district?: string;
}

export type EvidenceLocator =
  | { kind: 'url'; url: string; anchor?: string }
  | { kind: 'file'; fileId: string; fileName: string; page?: number }
  | {
      kind: 'worksheet';
      fileId: string;
      fileName: string;
      sheet: string;
      cell?: string;
    }
  | { kind: 'excerpt'; excerpt: string };

export type EvidenceReviewState =
  | 'official'
  | 'ai_extracted'
  | 'pending_review';

export interface EvidenceAnchor {
  id: string;
  locator: EvidenceLocator;
  excerpt?: string;
  state: EvidenceReviewState;
  checkedAt: string;
}

export type RequirementDimension =
  | 'region'
  | 'education'
  | 'degree'
  | 'major'
  | 'graduate_status'
  | 'teacher_cert'
  | 'age'
  | 'hukou'
  | 'social_security'
  | 'work_experience'
  | 'other';

export type CredentialLevel =
  | 'secondary'
  | 'college'
  | 'bachelor'
  | 'master'
  | 'doctorate';

export type DegreeCode = 'none' | 'bachelor' | 'master' | 'doctorate';

export type RequirementCriterion =
  | { kind: 'education'; minLevel: CredentialLevel }
  | { kind: 'degree'; requiredDegree: Exclude<DegreeCode, 'none'> }
  | {
      kind: 'major';
      majorNames: string[];
      catalogGroups?: string[];
      /** 目录表述存在解释空间（“相关专业”等），精确不中时转人工确认 */
      ambiguous?: boolean;
    }
  | { kind: 'graduate_status'; requireFresh: boolean }
  | {
      kind: 'teacher_cert';
      subject: SubjectCode;
      stage: StageCode;
      acceptInProgress: boolean;
    }
  | { kind: 'age'; maxAgeYears: number; referenceDate?: string }
  | { kind: 'hukou'; allowedRegionCodes: string[]; label: string }
  | { kind: 'social_security'; requireNone: boolean }
  | { kind: 'work_experience'; minMonths: number }
  | { kind: 'other'; manualReview: boolean };

export interface Requirement {
  id: string;
  dimension: RequirementDimension;
  /** 公告原文表述（详情页第三层字段出处） */
  description: string;
  hard: boolean;
  criterion: RequirementCriterion;
  evidence: EvidenceAnchor;
}

export type OrganizationType =
  | 'government_unified'
  | 'institution_unified'
  | 'other';

export interface ApplicationUnit {
  id: string;
  code: string;
  name: string;
  announcementId: string;
  versionId: string;
  region: RegionRef;
  teachingScope?: string;
  subject: SubjectCode;
  stage: StageCode;
  headcount: number;
  organizationType: OrganizationType;
  employmentNature: EmploymentNature;
  allocation: AllocationMethod;
  registerUrl?: string;
  requirements: Requirement[];
}

export type AnnouncementSourceKind = 'original' | 'supplement' | 'correction';

export interface AnnouncementTimeline {
  registrationStart: string;
  registrationEnd: string;
  paymentDeadline?: string;
  admitTicketStart?: string;
  writtenExamDate?: string;
  scoreDate?: string;
  interviewDate?: string;
  pendingItems?: string[];
}

export interface AnnouncementVersion {
  id: string;
  announcementId: string;
  versionNumber: number;
  sourceKind: AnnouncementSourceKind;
  publishedAt: string;
  officialSource: EvidenceAnchor;
  timeline: AnnouncementTimeline;
  units: ApplicationUnit[];
  changeNote?: string;
  supersededAt?: string;
}

export type AnnouncementLifecycle = 'active' | 'withdrawn';

export interface RecruitmentAnnouncement {
  id: string;
  title: string;
  publisher: string;
  organizationType: OrganizationType;
  officialUrl: string;
  subjectScope: SubjectCode[];
  region: RegionRef;
  lifecycle: AnnouncementLifecycle;
  firstPublishedAt: string;
  versions: AnnouncementVersion[];
}

// ==================== 用户画像 ====================

export type RegionPreferenceLevel = 'required' | 'preferred' | 'consider';

export interface RegionPreference {
  code: string;
  province: string;
  city?: string;
  level: RegionPreferenceLevel;
}

export type TeacherCertStatus = 'obtained' | 'in_progress' | 'none';

export interface TeacherCertInfo {
  status: TeacherCertStatus;
  subject?: SubjectCode;
  stage?: StageCode;
  expectedDate?: string;
}

export type EmploymentStatus =
  | 'student'
  | 'fresh_unemployed'
  | 'employed_fulltime'
  | 'employed_parttime'
  | 'other';

/** 匹配接口入参：五组基础画像 + 按需补充的条件事实（未提供即 UNKNOWN） */
export interface UserRecruitmentProfile {
  regions: RegionPreference[];
  educationLevel: CredentialLevel;
  degree: DegreeCode;
  majorFullName: string;
  graduationDate?: string;
  employmentStatus: EmploymentStatus;
  teacherCert: TeacherCertInfo;
  acceptedEmploymentNatures: EmploymentNatureCode[];
  // 条件画像：缺省只能得到 UNKNOWN，绝不转 FAIL
  birthDate?: string;
  hukouRegionCode?: string;
  socialSecurityMonths?: number;
  workExperienceMonths?: number;
  extraAnswers?: Record<string, string>;
}

// ==================== 匹配结果 ====================

export type MatchValue = 'PASS' | 'FAIL' | 'UNKNOWN' | 'MANUAL_REVIEW';

export type OpportunityMatchStatus =
  | 'preliminary_eligible'
  | 'need_more_info'
  | 'manual_review'
  | 'not_eligible';

export interface MatchDimensionResult {
  requirementId: string;
  dimension: RequirementDimension;
  value: MatchValue;
  reason: string;
  hard: boolean;
}

export type GateCode =
  | 'subject_not_open'
  | 'registration_closed'
  | 'out_of_scope_nature'
  | 'announcement_withdrawn'
  | 'no_official_source';

export interface GateResult {
  code: GateCode;
  passed: boolean;
  reason: string;
}

export interface OpportunityMatchResult {
  unitId: string;
  announcementId: string;
  versionId: string;
  gates: GateResult[];
  dimensions: MatchDimensionResult[];
  overall: OpportunityMatchStatus;
  summary: string;
}

export interface OpportunityCandidate {
  announcement: RecruitmentAnnouncement;
  version: AnnouncementVersion;
  unit: ApplicationUnit;
  match: OpportunityMatchResult;
}

export const MATCH_STATUS_LABELS: Record<OpportunityMatchStatus, string> = {
  preliminary_eligible: '初步符合',
  need_more_info: '补充信息后判断',
  manual_review: '建议人工确认',
  not_eligible: '明确不符合',
};
