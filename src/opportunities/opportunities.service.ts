import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { CATALOG_ANNOUNCEMENTS } from '../matching/catalog.js';
import { buildCandidates, currentVersion } from '../matching/engine.js';
import type {
  CredentialLevel,
  DegreeCode,
  EmploymentNatureCode,
  EmploymentStatus,
  RegionPreferenceLevel,
  TeacherCertStatus,
  UserRecruitmentProfile,
} from '../matching/types.js';
import {
  canTransition,
  isFollowStatus,
  transitionFollow,
  type FollowRecord,
  type FollowStatus,
  type FollowStatusEvent,
  type StudyTargetRole,
} from './follow.domain.js';
import {
  buildMatchResponse,
  buildUnitDetail,
  type FollowDTO,
  type MatchResponse,
  type UnitDetailResponse,
} from './view.js';

/**
 * 机会发现服务（PRD 7.4/7.5/7.7/7.10）。
 *
 * - 匹配为“按请求即时计算”：每次请求用当前画像 + 已发布公告目录现算，
 *   受邀用户量级很小，不引入批量队列与缓存；
 * - 画像由前端随请求提交（基础画像 + 补问事实），服务端不做规则缓存，
 *   用户修改画像后的下一次请求即为新结果；
 * - 关注关系与纠错留痕持久化在 PostgreSQL。
 */
@Injectable()
export class OpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== 匹配：列表 / 详情 ====================

  async match(profile: unknown, userId: string): Promise<MatchResponse> {
    const valid = this.validateProfile(profile);
    const candidates = buildCandidates(
      CATALOG_ANNOUNCEMENTS,
      valid,
      new Date().toISOString(),
    );
    return this.assemble(candidates, valid, userId);
  }

  async unitDetail(
    profile: unknown,
    userId: string,
    unitId: string,
  ): Promise<UnitDetailResponse> {
    const valid = this.validateProfile(profile);
    const candidates = buildCandidates(
      CATALOG_ANNOUNCEMENTS,
      valid,
      new Date().toISOString(),
    );
    const follows = await this.listFollowRecords(userId);
    const detail = buildUnitDetail(candidates, unitId, follows, new Date());
    if (!detail) {
      throw new NotFoundException('未找到该报考单元，它可能不属于当前已发布公告');
    }
    return detail;
  }

  private async assemble(
    candidates: ReturnType<typeof buildCandidates>,
    profile: UserRecruitmentProfile,
    userId: string,
  ): Promise<MatchResponse> {
    const follows = await this.listFollowRecords(userId);
    return buildMatchResponse(candidates, profile, follows, new Date());
  }

  // ==================== 关注关系 ====================

  async listFollows(userId: string): Promise<FollowDTO[]> {
    const follows = await this.listFollowRecords(userId);
    return follows.map((follow) => {
      const announcement = CATALOG_ANNOUNCEMENTS.find(
        (a) => a.id === follow.announcementId,
      );
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
        newerVersion: announcement
          ? follow.versionId !== currentVersion(announcement).id
          : false,
        remindersMuted: follow.remindersMuted,
      };
    });
  }

  /**
   * 关注一个报考单元。收藏 ≠ 准备报名：初始状态恒为 considering。
   * 重复关注幂等返回已有记录（状态不被重置）。
   */
  async follow(userId: string, unitId: string): Promise<FollowDTO> {
    const target = this.findCatalogUnit(unitId);
    const existing = await this.prisma.followedOpportunity.findUnique({
      where: { userId_unitId: { userId, unitId } },
    });
    if (existing) {
      return this.toDTO(this.fromRow(existing));
    }
    const atIso = new Date().toISOString();
    const row = await this.prisma.followedOpportunity.create({
      data: {
        userId,
        unitId,
        announcementId: target.announcementId,
        versionId: target.versionId,
        status: 'considering',
        role: null,
        followedAt: new Date(atIso),
        statusHistory: [
          { status: 'considering', at: atIso },
        ] satisfies Prisma.InputJsonValue,
        abandonReason: null,
      },
    });
    return this.toDTO(this.fromRow(row));
  }

  /** 状态流转（非法边由领域层拒绝）；只影响该单元，其他关注记录不变 */
  async transition(
    userId: string,
    unitId: string,
    nextInput: unknown,
    note?: string,
    abandonReason?: string,
  ): Promise<FollowDTO> {
    const next = this.asFollowStatus(nextInput);
    const row = await this.prisma.followedOpportunity.findUnique({
      where: { userId_unitId: { userId, unitId } },
    });
    if (!row) throw new NotFoundException('尚未关注该机会');
    const current = this.fromRow(row);
    if (!canTransition(current.status, next)) {
      throw new BadRequestException(
        `不允许从「${current.status}」流转到「${next}」`,
      );
    }
    const updated = transitionFollow(
      current,
      next,
      new Date().toISOString(),
      note,
      abandonReason,
    );
    const saved = await this.prisma.followedOpportunity.update({
      where: { userId_unitId: { userId, unitId } },
      data: {
        status: updated.status,
        statusHistory: updated.statusHistory as unknown as Prisma.InputJsonValue,
        abandonReason: updated.abandonReason,
      },
    });
    return this.toDTO(this.fromRow(saved));
  }

  /** 取消关注（删除记录，不影响其他机会） */
  async unfollow(userId: string, unitId: string): Promise<{ ok: true }> {
    await this.prisma.followedOpportunity.deleteMany({
      where: { userId, unitId },
    });
    return { ok: true };
  }

  /**
   * 设置/取消备考角色。主要目标全局唯一：设为 primary 时，
   * 同一用户原 primary 在事务内自动降为 backup（PRD 7.7）。
   */
  async setRole(
    userId: string,
    unitId: string,
    roleInput: unknown,
  ): Promise<FollowDTO> {
    const role = this.asRole(roleInput);
    const target = await this.prisma.followedOpportunity.findUnique({
      where: { userId_unitId: { userId, unitId } },
    });
    if (!target) throw new NotFoundException('请先关注该机会，再设置备考目标');

    if (role === 'primary') {
      await this.prisma.$transaction([
        this.prisma.followedOpportunity.updateMany({
          where: { userId, role: 'primary', NOT: { unitId } },
          data: { role: 'backup' },
        }),
        this.prisma.followedOpportunity.update({
          where: { userId_unitId: { userId, unitId } },
          data: { role: 'primary' },
        }),
      ]);
    } else {
      await this.prisma.followedOpportunity.update({
        where: { userId_unitId: { userId, unitId } },
        data: { role: 'backup' },
      });
    }
    const row = await this.prisma.followedOpportunity.findUniqueOrThrow({
      where: { userId_unitId: { userId, unitId } },
    });
    return this.toDTO(this.fromRow(row));
  }

  /** 开启/关闭单个机会的站内提醒（日程仍可见，只是不产生通知） */
  async setRemindersMuted(
    userId: string,
    unitId: string,
    muted: boolean,
  ): Promise<FollowDTO> {
    const row = await this.prisma.followedOpportunity.findUnique({
      where: { userId_unitId: { userId, unitId } },
    });
    if (!row) throw new NotFoundException('请先关注该机会，再设置提醒开关');
    const updated = await this.prisma.followedOpportunity.update({
      where: { userId_unitId: { userId, unitId } },
      data: { remindersMuted: muted },
    });
    return this.toDTO(this.fromRow(updated));
  }

  // ==================== 纠错提交（证据层，PRD 7.10） ====================

  async submitCorrection(
    userId: string,
    unitId: string,
    body: { fieldPath?: unknown; content?: unknown; contact?: unknown },
  ): Promise<{ id: string; status: string }> {
    const target = this.findCatalogUnit(unitId);
    const fieldPath = typeof body.fieldPath === 'string' ? body.fieldPath.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!fieldPath) {
      throw new BadRequestException('请选择要纠错的内容位置（条件/证据/版本）');
    }
    if (content.length < 5) {
      throw new BadRequestException('请填写至少 5 个字的纠错说明');
    }
    if (content.length > 1000) {
      throw new BadRequestException('纠错说明不能超过 1000 字');
    }
    const row = await this.prisma.opportunityCorrection.create({
      data: {
        userId,
        unitId,
        announcementId: target.announcementId,
        versionId: target.versionId,
        fieldPath,
        content,
        contact:
          typeof body.contact === 'string' && body.contact.trim()
            ? body.contact.trim().slice(0, 200)
            : null,
      },
    });
    return { id: row.id, status: row.status };
  }

  // ==================== 内部工具 ====================

  private findCatalogUnit(unitId: string): {
    announcementId: string;
    versionId: string;
  } {
    for (const announcement of CATALOG_ANNOUNCEMENTS) {
      const version = currentVersion(announcement);
      const unit = version.units.find((u) => u.id === unitId);
      if (unit) return { announcementId: announcement.id, versionId: version.id };
    }
    throw new NotFoundException('未找到该报考单元，它可能不属于当前已发布公告');
  }

  private async listFollowRecords(userId: string): Promise<FollowRecord[]> {
    const rows = await this.prisma.followedOpportunity.findMany({
      where: { userId },
      orderBy: { followedAt: 'asc' },
    });
    return rows.map((row) => this.fromRow(row));
  }

  private fromRow(row: {
    id: string;
    userId: string;
    unitId: string;
    announcementId: string;
    versionId: string;
    status: string;
    role: string | null;
    followedAt: Date;
    statusHistory: Prisma.JsonValue;
    abandonReason: string | null;
    remindersMuted?: boolean;
  }): FollowRecord {
    return {
      id: row.id,
      userId: row.userId,
      unitId: row.unitId,
      announcementId: row.announcementId,
      versionId: row.versionId,
      status: (isFollowStatus(row.status) ? row.status : 'considering') as FollowStatus,
      role: row.role === 'primary' || row.role === 'backup' ? row.role : null,
      followedAt: row.followedAt.toISOString(),
      statusHistory: row.statusHistory as unknown as FollowStatusEvent[],
      abandonReason: row.abandonReason,
      remindersMuted: row.remindersMuted ?? false,
    };
  }

  private toDTO(follow: FollowRecord): FollowDTO {
    const announcement = CATALOG_ANNOUNCEMENTS.find(
      (a) => a.id === follow.announcementId,
    );
    const currentVersionId = announcement
      ? currentVersion(announcement).id
      : follow.versionId;
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
      newerVersion: follow.versionId !== currentVersionId,
      remindersMuted: follow.remindersMuted,
    };
  }

  private asFollowStatus(value: unknown): FollowStatus {
    if (isFollowStatus(value)) return value;
    throw new BadRequestException('非法的关注状态');
  }

  private asRole(value: unknown): StudyTargetRole {
    if (value === 'primary' || value === 'backup') return value;
    throw new BadRequestException('备考目标角色只能是 primary 或 backup');
  }

  /**
   * 画像入参校验（只做结构与枚举校验，不做业务推断）。
   * 缺省的条件事实（birthDate/hukouRegionCode 等）保持 undefined，
   * 由匹配引擎产出 UNKNOWN。
   */
  private validateProfile(input: unknown): UserRecruitmentProfile {
    if (typeof input !== 'object' || input === null) {
      throw new BadRequestException('请求体缺少画像数据 profile');
    }
    const p = input as Record<string, unknown>;

    if (!Array.isArray(p.regions)) {
      throw new BadRequestException('画像 regions 必须是数组');
    }
    const regionLevels: RegionPreferenceLevel[] = [
      'required',
      'preferred',
      'consider',
    ];
    const regions = p.regions.map((raw, index) => {
      if (typeof raw !== 'object' || raw === null) {
        throw new BadRequestException(`regions[${index}] 结构不正确`);
      }
      const r = raw as Record<string, unknown>;
      if (
        typeof r.code !== 'string' ||
        typeof r.province !== 'string' ||
        !regionLevels.includes(r.level as RegionPreferenceLevel)
      ) {
        throw new BadRequestException(`regions[${index}] 字段不完整或取值非法`);
      }
      return {
        code: r.code,
        province: r.province,
        city: typeof r.city === 'string' ? r.city : undefined,
        district: typeof r.district === 'string' ? r.district : undefined,
        level: r.level as RegionPreferenceLevel,
      };
    });

    const educationLevels: CredentialLevel[] = [
      'secondary',
      'college',
      'bachelor',
      'master',
      'doctorate',
    ];
    if (!educationLevels.includes(p.educationLevel as CredentialLevel)) {
      throw new BadRequestException('画像 educationLevel 取值非法');
    }
    const degrees: DegreeCode[] = ['none', 'bachelor', 'master', 'doctorate'];
    if (!degrees.includes(p.degree as DegreeCode)) {
      throw new BadRequestException('画像 degree 取值非法');
    }
    if (typeof p.majorFullName !== 'string') {
      throw new BadRequestException('画像 majorFullName 必须是字符串');
    }
    const employmentStatuses: EmploymentStatus[] = [
      'student',
      'fresh_unemployed',
      'employed_fulltime',
      'employed_parttime',
      'other',
    ];
    if (!employmentStatuses.includes(p.employmentStatus as EmploymentStatus)) {
      throw new BadRequestException('画像 employmentStatus 取值非法');
    }
    if (typeof p.teacherCert !== 'object' || p.teacherCert === null) {
      throw new BadRequestException('画像 teacherCert 结构不正确');
    }
    const cert = p.teacherCert as Record<string, unknown>;
    const certStatuses: TeacherCertStatus[] = [
      'obtained',
      'in_progress',
      'none',
    ];
    if (!certStatuses.includes(cert.status as TeacherCertStatus)) {
      throw new BadRequestException('画像 teacherCert.status 取值非法');
    }
    if (
      !Array.isArray(p.acceptedEmploymentNatures) ||
      p.acceptedEmploymentNatures.some(
        (n) =>
          !([
            'public_institution_staff',
            'record_filing',
            'post_quota',
            'headcount_control',
            'other',
          ] as EmploymentNatureCode[]).includes(n as EmploymentNatureCode),
      )
    ) {
      throw new BadRequestException(
        '画像 acceptedEmploymentNatures 必须是用工性质枚举数组',
      );
    }

    const optionalIso = (key: string): string | undefined => {
      const v = p[key];
      if (v === undefined || v === null || v === '') return undefined;
      if (typeof v !== 'string' || Number.isNaN(new Date(v).getTime())) {
        throw new BadRequestException(`画像 ${key} 不是合法日期`);
      }
      return v;
    };
    const optionalMonths = (key: string): number | undefined => {
      const v = p[key];
      if (v === undefined || v === null || v === '') return undefined;
      if (typeof v !== 'number' || v < 0 || !Number.isFinite(v)) {
        throw new BadRequestException(`画像 ${key} 必须是非负数字`);
      }
      return v;
    };

    return {
      regions,
      educationLevel: p.educationLevel as CredentialLevel,
      degree: p.degree as DegreeCode,
      majorFullName: p.majorFullName,
      graduationDate: optionalIso('graduationDate'),
      employmentStatus: p.employmentStatus as EmploymentStatus,
      teacherCert: {
        status: cert.status as TeacherCertStatus,
        subject: typeof cert.subject === 'string' ? cert.subject : undefined,
        stage: typeof cert.stage === 'string' ? cert.stage : undefined,
        expectedDate:
          typeof cert.expectedDate === 'string'
            ? cert.expectedDate
            : undefined,
      },
      acceptedEmploymentNatures:
        p.acceptedEmploymentNatures as EmploymentNatureCode[],
      birthDate: optionalIso('birthDate'),
      hukouRegionCode:
        typeof p.hukouRegionCode === 'string' && p.hukouRegionCode
          ? p.hukouRegionCode
          : undefined,
      socialSecurityMonths: optionalMonths('socialSecurityMonths'),
      workExperienceMonths: optionalMonths('workExperienceMonths'),
      extraAnswers:
        typeof p.extraAnswers === 'object' &&
        p.extraAnswers !== null &&
        !Array.isArray(p.extraAnswers)
          ? (p.extraAnswers as Record<string, string>)
          : undefined,
    };
  }
}
