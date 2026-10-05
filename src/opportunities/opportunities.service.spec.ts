import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAJOR_ALIAS_VERSION,
  MATCH_RULE_VERSION,
} from '../matching/engine.js';
import { CATALOG_VERSION } from '../matching/catalog.js';
import type { UserRecruitmentProfile } from '../matching/types.js';
import { OpportunitiesService } from './opportunities.service.js';

const PROFILE: UserRecruitmentProfile = {
  regions: [
    { code: '330000', province: '浙江省', level: 'required' },
    { code: '320000', province: '江苏省', level: 'consider' },
    { code: '340000', province: '安徽省', level: 'consider' },
  ],
  educationLevel: 'bachelor',
  degree: 'bachelor',
  majorFullName: '汉语言文学（师范）',
  graduationDate: '2026-06-30',
  employmentStatus: 'fresh_unemployed',
  socialSecurityMonths: 0,
  teacherCert: { status: 'obtained', subject: 'chinese', stage: 'middle' },
  acceptedEmploymentNatures: [
    'public_institution_staff',
    'record_filing',
    'post_quota',
    'headcount_control',
    'other',
  ],
};

interface FollowRow {
  id: string;
  userId: string;
  unitId: string;
  announcementId: string;
  versionId: string;
  status: string;
  role: string | null;
  followedAt: Date;
  statusHistory: unknown;
  abandonReason: string | null;
}

/** 内存版 Prisma：只实现 service 实际用到的模型方法 */
function createFakePrisma() {
  const rows = new Map<string, FollowRow>();
  const corrections: Array<Record<string, unknown>> = [];
  let seq = 0;
  const keyOf = (userId: string, unitId: string) => `${userId}::${unitId}`;

  const followedOpportunity = {
    findUnique: async ({
      where,
    }: {
      where: { userId_unitId: { userId: string; unitId: string } };
    }) => rows.get(keyOf(where.userId_unitId.userId, where.userId_unitId.unitId)) ?? null,
    findUniqueOrThrow: async ({
      where,
    }: {
      where: { userId_unitId: { userId: string; unitId: string } };
    }) => {
      const row = rows.get(
        keyOf(where.userId_unitId.userId, where.userId_unitId.unitId),
      );
      if (!row) throw new Error('not found');
      return row;
    },
    findMany: async ({ where }: { where: { userId: string } }) =>
      [...rows.values()]
        .filter((r) => r.userId === where.userId)
        .sort((a, b) => a.followedAt.getTime() - b.followedAt.getTime()),
    create: async ({ data }: { data: Omit<FollowRow, 'id'> }) => {
      const row: FollowRow = { ...data, id: `gen-${++seq}` };
      rows.set(keyOf(row.userId, row.unitId), row);
      return row;
    },
    update: async ({
      where,
      data,
    }: {
      where: { userId_unitId: { userId: string; unitId: string } };
      data: Partial<FollowRow>;
    }) => {
      const row = rows.get(
        keyOf(where.userId_unitId.userId, where.userId_unitId.unitId),
      );
      if (!row) throw new Error('not found');
      Object.assign(row, data);
      return row;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: {
        userId: string;
        role: string;
        NOT: { unitId: string };
      };
      data: Partial<FollowRow>;
    }) => {
      let count = 0;
      for (const row of rows.values()) {
        if (
          row.userId === where.userId &&
          row.role === where.role &&
          row.unitId !== where.NOT.unitId
        ) {
          Object.assign(row, data);
          count += 1;
        }
      }
      return { count };
    },
    deleteMany: async ({
      where,
    }: {
      where: { userId: string; unitId: string };
    }) => {
      let count = 0;
      if (rows.delete(keyOf(where.userId, where.unitId))) count = 1;
      return { count };
    },
  };

  const opportunityCorrection = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `cor-${++seq}`, status: 'submitted', ...data };
      corrections.push(row);
      return row;
    },
  };

  return {
    prisma: {
      followedOpportunity,
      opportunityCorrection,
      $transaction: async (ops: Array<Promise<unknown>>) => Promise.all(ops),
    } as never,
    rows,
    corrections,
  };
}

describe('OpportunitiesService：匹配响应', () => {
  it('六场景全部出现且每条结论携带规则版本、公告版本与证据锚点', async () => {
    const fake = createFakePrisma();
    const service = new OpportunitiesService(fake.prisma);
    const response = await service.match(PROFILE, 'user-1');

    expect(response.meta.ruleVersion).toBe(MATCH_RULE_VERSION);
    expect(response.meta.majorAliasVersion).toBe(MAJOR_ALIAS_VERSION);
    expect(response.meta.catalogVersion).toBe(CATALOG_VERSION);
    expect(response.meta.evaluatedAt).toBeTruthy();

    const all = [
      ...response.groups.preliminary,
      ...response.groups.needInfo.flatMap((g) => g.units),
      ...response.groups.manualReview,
      ...response.groups.notEligible,
      ...response.groups.closed,
    ];
    // 6 条公告当前版本各一个报考单元（合肥 v1 被 v2 取代，不出现 v1）
    expect(all).toHaveLength(6);
    const unitIds = all.map((u) => u.unit.id);
    expect(unitIds).toContain('unit-hefei-01-v2');
    expect(unitIds).not.toContain('unit-hefei-01-v1');

    for (const dto of all) {
      expect(dto.version.id).toMatch(/^ann-.+-v\d+$/);
      expect(dto.version.officialSource.state).toBe('official');
      expect(dto.gates.length).toBeGreaterThan(0);
      for (const dimension of dto.dimensions) {
        // 地区是用户偏好约束；其余条件必须能追溯公告原文与证据
        if (dimension.dimension === 'region') {
          expect(dimension.requirementDescription).toBeTruthy();
          expect(dimension.evidence).toBeUndefined();
        } else {
          expect(dimension.requirementDescription).toBeTruthy();
          expect(dimension.evidence?.state).toBe('official');
          expect(dimension.evidence?.locator).toBeTruthy();
        }
      }
    }
  });

  it('画像结构非法时抛 400，不产出任何结果', async () => {
    const service = new OpportunitiesService(createFakePrisma().prisma);
    await expect(
      service.match({ ...PROFILE, regions: 'bad' }, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('详情返回三层所需的逐条件/版本链数据；未知单元 404', async () => {
    const service = new OpportunitiesService(createFakePrisma().prisma);
    const detail = await service.unitDetail(
      PROFILE,
      'user-1',
      'unit-hangzhou-01',
    );
    expect(detail.unit.announcement.title).toContain('杭州');
    expect(detail.unit.version.versionNumber).toBe(1);
    expect(detail.previousVersions).toEqual([]);

    const hefei = await service.unitDetail(
      PROFILE,
      'user-1',
      'unit-hefei-01-v2',
    );
    expect(hefei.previousVersions).toHaveLength(1);
    expect(hefei.previousVersions[0]?.supersededAt).toBeTruthy();
    // 延期与扩招说明挂在当前版本 v2 的 changeNote 上
    expect(hefei.unit.version.changeNote).toContain('延至');
    expect(hefei.unit.version.changeNote).toContain('8人');

    await expect(
      service.unitDetail(PROFILE, 'user-1', 'not-exist'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('OpportunitiesService：关注与状态流转', () => {
  let fake: ReturnType<typeof createFakePrisma>;
  let service: OpportunitiesService;

  beforeEach(() => {
    fake = createFakePrisma();
    service = new OpportunitiesService(fake.prisma);
  });

  it('关注初始为 considering；重复关注幂等不重置状态', async () => {
    const first = await service.follow('user-1', 'unit-hangzhou-01');
    expect(first.status).toBe('considering');
    expect(first.role).toBeNull();
    expect(first.statusHistory).toHaveLength(1);

    await service.transition('user-1', 'unit-hangzhou-01', 'preparing');
    const second = await service.follow('user-1', 'unit-hangzhou-01');
    expect(second.status).toBe('preparing');
    expect(fake.rows.size).toBe(1);
  });

  it('关注后匹配结果的对应卡片携带 follow；其他卡片不受影响', async () => {
    await service.follow('user-1', 'unit-hangzhou-01');
    const response = await service.match(PROFILE, 'user-1');
    const all = [
      ...response.groups.preliminary,
      ...response.groups.needInfo.flatMap((g) => g.units),
      ...response.groups.manualReview,
      ...response.groups.notEligible,
      ...response.groups.closed,
    ];
    const followed = all.filter((u) => u.follow !== null);
    expect(followed).toHaveLength(1);
    expect(followed[0]?.unit.id).toBe('unit-hangzhou-01');
  });

  it('非法流转（considering → registered）被拒绝；未关注先流转报 404', async () => {
    await service.follow('user-1', 'unit-hangzhou-01');
    await expect(
      service.transition('user-1', 'unit-hangzhou-01', 'registered'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.transition('user-1', 'unit-yinzhou-01', 'preparing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('关注状态切换不影响其他机会，也不影响其他用户', async () => {
    await service.follow('user-1', 'unit-hangzhou-01');
    await service.follow('user-1', 'unit-yinzhou-01');
    await service.follow('user-2', 'unit-hangzhou-01');

    await service.transition('user-1', 'unit-hangzhou-01', 'abandoned', undefined, '时间冲突');
    const followsUser1 = await service.listFollows('user-1');
    const hz = followsUser1.find((f) => f.unitId === 'unit-hangzhou-01');
    const yz = followsUser1.find((f) => f.unitId === 'unit-yinzhou-01');
    expect(hz?.status).toBe('abandoned');
    expect(hz?.abandonReason).toBe('时间冲突');
    expect(yz?.status).toBe('considering');

    const followsUser2 = await service.listFollows('user-2');
    expect(followsUser2[0]?.status).toBe('considering');
  });

  it('取消关注只删除该单元记录', async () => {
    await service.follow('user-1', 'unit-hangzhou-01');
    await service.follow('user-1', 'unit-yinzhou-01');
    await service.unfollow('user-1', 'unit-hangzhou-01');
    const follows = await service.listFollows('user-1');
    expect(follows.map((f) => f.unitId)).toEqual(['unit-yinzhou-01']);
  });
});

describe('OpportunitiesService：主要备考目标', () => {
  it('设新 primary 时旧 primary 事务内自动降 backup；未关注不能设角色', async () => {
    const fake = createFakePrisma();
    const service = new OpportunitiesService(fake.prisma);
    await service.follow('user-1', 'unit-hangzhou-01');
    await service.follow('user-1', 'unit-yinzhou-01');

    await service.setRole('user-1', 'unit-hangzhou-01', 'primary');
    await service.setRole('user-1', 'unit-yinzhou-01', 'primary');

    const follows = await service.listFollows('user-1');
    expect(follows.find((f) => f.unitId === 'unit-hangzhou-01')?.role).toBe(
      'backup',
    );
    expect(follows.find((f) => f.unitId === 'unit-yinzhou-01')?.role).toBe(
      'primary',
    );

    await expect(
      service.setRole('user-1', 'unit-suzhou-01', 'primary'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.setRole('user-1', 'unit-hangzhou-01', 'only' as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('匹配响应返回 primaryTargetUnitId', async () => {
    const service = new OpportunitiesService(createFakePrisma().prisma);
    await service.follow('user-1', 'unit-hangzhou-01');
    await service.setRole('user-1', 'unit-hangzhou-01', 'primary');
    const response = await service.match(PROFILE, 'user-1');
    expect(response.primaryTargetUnitId).toBe('unit-hangzhou-01');
  });
});

describe('OpportunitiesService：纠错留痕', () => {
  it('纠错绑定当前公告版本；内容过短或缺少位置时拒绝', async () => {
    const fake = createFakePrisma();
    const service = new OpportunitiesService(fake.prisma);

    const created = await service.submitCorrection(
      'user-1',
      'unit-hefei-01-v2',
      { fieldPath: 'major', content: '专业目录少列了一个专业名称' },
    );
    expect(created.status).toBe('submitted');
    expect(fake.corrections[0]?.versionId).toBe('ann-hefei-v2');

    await expect(
      service.submitCorrection('user-1', 'unit-hangzhou-01', {
        fieldPath: 'age',
        content: '太短',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.submitCorrection('user-1', 'unit-hangzhou-01', {
        fieldPath: '',
        content: '这里是足够长的纠错说明文字',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
