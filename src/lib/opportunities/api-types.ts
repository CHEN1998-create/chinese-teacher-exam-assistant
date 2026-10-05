/**
 * 机会模块后端响应类型（模块 5）。
 *
 * 这些类型是后端 src/opportunities/view.ts DTO 的镜像：匹配结论、逐条件结果、
 * 证据锚点与版本信息全部由后端产出，前端只渲染、不复制判断逻辑。
 */
import type { UserRecruitmentProfile } from "@/lib/profile/types";

export type MatchValue = "PASS" | "FAIL" | "UNKNOWN" | "MANUAL_REVIEW";
export type OpportunityMatchStatus =
  | "preliminary_eligible"
  | "need_more_info"
  | "manual_review"
  | "not_eligible";

export type FollowStatus =
  | "considering"
  | "preparing"
  | "registered"
  | "abandoned"
  | "closed";

export type StudyTargetRole = "primary" | "backup";

export interface EvidenceLocatorDTO {
  kind: "url" | "file" | "worksheet" | "excerpt";
  url?: string;
  anchor?: string;
  fileName?: string;
  page?: number;
  sheet?: string;
  cell?: string;
  excerpt?: string;
}

export interface EvidenceAnchorDTO {
  id: string;
  locator: EvidenceLocatorDTO;
  excerpt?: string;
  /** official=官方已核对；ai_extracted/pending_review 不得当作正式依据 */
  state: "official" | "ai_extracted" | "pending_review";
  checkedAt: string;
}

export interface RegionRefDTO {
  code: string;
  province: string;
  city?: string;
  district?: string;
}

export interface GateDTO {
  code:
    | "subject_not_open"
    | "registration_closed"
    | "out_of_scope_nature"
    | "announcement_withdrawn"
    | "no_official_source";
  passed: boolean;
  reason: string;
}

export interface DimensionDTO {
  requirementId: string;
  dimension:
    | "region"
    | "education"
    | "degree"
    | "major"
    | "graduate_status"
    | "teacher_cert"
    | "age"
    | "hukou"
    | "social_security"
    | "work_experience"
    | "other";
  value: MatchValue;
  reason: string;
  hard: boolean;
  requirementDescription?: string;
  evidence?: EvidenceAnchorDTO;
}

export interface FollowStatusEventDTO {
  status: FollowStatus;
  at: string;
  note?: string;
}

export interface FollowDTO {
  id: string;
  unitId: string;
  announcementId: string;
  versionId: string;
  status: FollowStatus;
  role: StudyTargetRole | null;
  followedAt: string;
  statusHistory: FollowStatusEventDTO[];
  abandonReason: string | null;
  newerVersion: boolean;
}

export interface UnitMatchDTO {
  unit: {
    id: string;
    code: string;
    name: string;
    region: RegionRefDTO;
    stage: string;
    headcount: number;
    organizationType: string;
    employmentNature: { code: string; officialName: string };
    allocation: { code: string; description: string };
    teachingScope?: string;
    registerUrl?: string;
  };
  announcement: {
    id: string;
    title: string;
    publisher: string;
    organizationType: string;
    officialUrl: string;
  };
  version: {
    id: string;
    versionNumber: number;
    sourceKind: "original" | "supplement" | "correction" | string;
    publishedAt: string;
    changeNote?: string;
    timeline: {
      registrationStart: string;
      registrationEnd: string;
      paymentDeadline?: string;
      admitTicketStart?: string;
      writtenExamDate?: string;
      scoreDate?: string;
      interviewDate?: string;
      pendingItems?: string[];
    };
    officialSource: EvidenceAnchorDTO;
  };
  gates: GateDTO[];
  dimensions: DimensionDTO[];
  overall: OpportunityMatchStatus;
  summary: string;
  follow: FollowDTO | null;
}

export interface MetaDTO {
  ruleVersion: string;
  majorAliasVersion: string;
  catalogVersion: string;
  evaluatedAt: string;
}

export interface MatchResponse {
  meta: MetaDTO;
  primaryTargetUnitId: string | null;
  groups: {
    preliminary: UnitMatchDTO[];
    needInfo: { dimension: string; count: number; units: UnitMatchDTO[] }[];
    manualReview: UnitMatchDTO[];
    notEligible: UnitMatchDTO[];
    closed: UnitMatchDTO[];
  };
  follows: FollowDTO[];
}

export interface UnitDetailResponse {
  meta: MetaDTO;
  unit: UnitMatchDTO;
  previousVersions: {
    id: string;
    versionNumber: number;
    sourceKind: string;
    publishedAt: string;
    supersededAt?: string;
    changeNote?: string;
  }[];
}

/** POST 请求体：前端只提交画像与补问答案，判定在后端完成 */
export type ProfilePayload = { profile: UserRecruitmentProfile };
