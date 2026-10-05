/**
 * 机会 API 视图装配（纯函数）。
 *
 * 职责：把匹配引擎的候选结果与用户关注记录组装成前端直接渲染的 DTO——
 * 逐条件结果必须附带公告原文表述（requirementDescription）与证据锚点，
 * 每条结论同时携带 ruleVersion / 公告版本 id / catalogVersion，
 * 前端不再复制任何判定逻辑（PRD 7.4）。
 */
import { CATALOG_VERSION } from '../matching/catalog.js';
import {
  MAJOR_ALIAS_VERSION,
  MATCH_RULE_VERSION,
  currentVersion,
  groupByMissingDimension,
  sortCandidates,
} from '../matching/engine.js';
import type {
  ApplicationUnit,
  EvidenceAnchor,
  OpportunityCandidate,
  RequirementDimension,
  UserRecruitmentProfile,
} from '../matching/types.js';
import {
  hasNewerVersion,
  type FollowRecord,
  type StudyTargetRole,
} from './follow.domain.js';

export interface MetaDTO {
  ruleVersion: string;
  majorAliasVersion: string;
  catalogVersion: string;
  evaluatedAt: string;
}

export interface FollowDTO {
  id: string;
  unitId: string;
  announcementId: string;
  versionId: string;
  status: FollowRecord['status'];
  role: StudyTargetRole | null;
  followedAt: string;
  statusHistory: FollowRecord['statusHistory'];
  abandonReason: string | null;
  /** 关注时的公告版本是否已被新版本取代 */
  newerVersion: boolean;
  /** 是否已关闭该机会的站内提醒 */
  remindersMuted: boolean;
}

export interface DimensionDTO {
  requirementId: string;
  dimension: RequirementDimension;
  value: 'PASS' | 'FAIL' | 'UNKNOWN' | 'MANUAL_REVIEW';
  reason: string;
  hard: boolean;
  /** 公告原文表述（地区维度为用户偏好约束，无公告原文） */
  requirementDescription?: string;
  evidence?: EvidenceAnchor;
}

export interface UnitMatchDTO {
  unit: Pick<
    ApplicationUnit,
    | 'id'
    | 'code'
    | 'name'
    | 'region'
    | 'stage'
    | 'headcount'
    | 'organizationType'
    | 'employmentNature'
    | 'allocation'
    | 'teachingScope'
    | 'registerUrl'
  >;
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
    sourceKind: string;
    publishedAt: string;
    changeNote?: string;
    timeline: OpportunityCandidate['version']['timeline'];
    officialSource: EvidenceAnchor;
  };
  gates: OpportunityCandidate['match']['gates'];
  dimensions: DimensionDTO[];
  overall: OpportunityCandidate['match']['overall'];
  summary: string;
  follow: FollowDTO | null;
}

export interface MatchGroupsDTO {
  preliminary: UnitMatchDTO[];
  needInfo: { dimension: string; count: number; units: UnitMatchDTO[] }[];
  manualReview: UnitMatchDTO[];
  notEligible: UnitMatchDTO[];
  /** 闸门未通过（已截止/失效/非收录），不进有效推荐，只在二级入口可见 */
  closed: UnitMatchDTO[];
}

export interface MatchResponse {
  meta: MetaDTO;
  primaryTargetUnitId: string | null;
  groups: MatchGroupsDTO;
  follows: FollowDTO[];
}

export interface UnitDetailResponse {
  meta: MetaDTO;
  unit: UnitMatchDTO;
  /** 被取代的历史版本链（详情第三层版本追溯） */
  previousVersions: {
    id: string;
    versionNumber: number;
    sourceKind: string;
    publishedAt: string;
    supersededAt?: string;
    changeNote?: string;
  }[];
}

export function buildMeta(now: Date): MetaDTO {
  return {
    ruleVersion: MATCH_RULE_VERSION,
    majorAliasVersion: MAJOR_ALIAS_VERSION,
    catalogVersion: CATALOG_VERSION,
    evaluatedAt: now.toISOString(),
  };
}

function toFollowDTO(
  follow: FollowRecord,
  currentVersionId: string,
): FollowDTO {
  return {
    id: follow.id,
    unitId: follow.unitId,
    announcementId: follow.announcementId,
    versionId: follow.versionId,
    status: follow.status,
    role: follow.role,
    followedAt: follow.followedAt,
    statusHistory: follow.statusHistory,
    abandonReason: follow.abandonReason,
    newerVersion: hasNewerVersion(follow, currentVersionId),
    remindersMuted: follow.remindersMuted,
  };
}

/** 逐条件结果关联公告原文表述与证据锚点；地区维度无对应公告条件 */
function toDimensions(candidate: OpportunityCandidate): DimensionDTO[] {
  const requirementsById = new Map(
    candidate.unit.requirements.map((req) => [req.id, req]),
  );
  return candidate.match.dimensions.map((dim) => {
    if (dim.dimension === 'region') {
      return {
        ...dim,
        requirementDescription: '岗位所在地区需在你填写的可接受就业地区范围内',
      };
    }
    const req = requirementsById.get(dim.requirementId);
    return req
      ? {
          ...dim,
          requirementDescription: req.description,
          evidence: req.evidence,
        }
      : dim;
  });
}

export function toUnitMatchDTO(
  candidate: OpportunityCandidate,
  follow: FollowRecord | null,
): UnitMatchDTO {
  const { announcement, version, unit, match } = candidate;
  return {
    unit: {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      region: unit.region,
      stage: unit.stage,
      headcount: unit.headcount,
      organizationType: unit.organizationType,
      employmentNature: unit.employmentNature,
      allocation: unit.allocation,
      teachingScope: unit.teachingScope,
      registerUrl: unit.registerUrl,
    },
    announcement: {
      id: announcement.id,
      title: announcement.title,
      publisher: announcement.publisher,
      organizationType: announcement.organizationType,
      officialUrl: announcement.officialUrl,
    },
    version: {
      id: version.id,
      versionNumber: version.versionNumber,
      sourceKind: version.sourceKind,
      publishedAt: version.publishedAt,
      changeNote: version.changeNote,
      timeline: version.timeline,
      officialSource: version.officialSource,
    },
    gates: match.gates,
    dimensions: toDimensions(candidate),
    overall: match.overall,
    summary: match.summary,
    follow: follow ? toFollowDTO(follow, version.id) : null,
  };
}

/**
 * 列表分组：默认只展示“初步符合”；需要补充（按缺失维度分组）、
 * 建议人工确认、明确不符合与闸门失败（已截止等）分别进入二级分组。
 */
export function buildMatchResponse(
  candidates: readonly OpportunityCandidate[],
  profile: UserRecruitmentProfile,
  follows: readonly FollowRecord[],
  now: Date,
): MatchResponse {
  const followByUnit = new Map(follows.map((f) => [f.unitId, f]));
  const sorted = sortCandidates([...candidates], profile);
  const dtoOf = (c: OpportunityCandidate) =>
    toUnitMatchDTO(c, followByUnit.get(c.unit.id) ?? null);

  const groups: MatchGroupsDTO = {
    preliminary: [],
    needInfo: groupByMissingDimension([...sorted]).map((g) => ({
      dimension: g.dimension,
      count: g.count,
      units: g.candidates.map(dtoOf),
    })),
    manualReview: [],
    notEligible: [],
    closed: [],
  };

  for (const candidate of sorted) {
    const dto = dtoOf(candidate);
    if (!candidate.match.gates.every((g) => g.passed)) {
      groups.closed.push(dto);
      continue;
    }
    switch (candidate.match.overall) {
      case 'preliminary_eligible':
        groups.preliminary.push(dto);
        break;
      case 'need_more_info':
        // 已在 needInfo 分组中
        break;
      case 'manual_review':
        groups.manualReview.push(dto);
        break;
      case 'not_eligible':
        groups.notEligible.push(dto);
        break;
    }
  }

  const followsDTO = follows.map((f) => {
    const candidate = sorted.find((c) => c.unit.id === f.unitId);
    const currentVersionId =
      candidate?.version.id ?? findCurrentVersionId(candidates, f);
    return toFollowDTO(f, currentVersionId);
  });
  const primary = follows.find((f) => f.role === 'primary');

  return {
    meta: buildMeta(now),
    primaryTargetUnitId: primary?.unitId ?? null,
    groups,
    follows: followsDTO,
  };
}

function findCurrentVersionId(
  candidates: readonly OpportunityCandidate[],
  follow: FollowRecord,
): string {
  const ann = candidates.find((c) => c.announcement.id === follow.announcementId);
  return ann ? currentVersion(ann.announcement).id : follow.versionId;
}

export function buildUnitDetail(
  candidates: readonly OpportunityCandidate[],
  unitId: string,
  follows: readonly FollowRecord[],
  now: Date,
): UnitDetailResponse | null {
  const candidate = candidates.find((c) => c.unit.id === unitId);
  if (!candidate) return null;
  const follow = follows.find((f) => f.unitId === unitId) ?? null;
  const previousVersions = candidate.announcement.versions
    .filter((v) => v.id !== candidate.version.id)
    .map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      sourceKind: v.sourceKind,
      publishedAt: v.publishedAt,
      supersededAt: v.supersededAt,
      changeNote: v.changeNote,
    }));
  return {
    meta: buildMeta(now),
    unit: toUnitMatchDTO(candidate, follow),
    previousVersions,
  };
}
