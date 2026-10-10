-- 关注机会的材料进度、咨询记录与乐观锁版本。
-- 这三个字段已由 FollowedOpportunity 领域模型使用；必须通过正式迁移补齐，
-- 避免 Prisma 在读取空关注列表时也因线上表结构落后而抛出 P2022。

ALTER TABLE "followed_opportunities"
  ADD COLUMN "material_statuses" JSONB,
  ADD COLUMN "consultation_notes" JSONB,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
