# 全国教师公开招聘与备考助手（后端）

“全国教师公开招聘与备考助手”的服务端。产品定位与需求见根目录 [`PRD-全国教师公开招聘与备考助手-v6.1.md`](../PRD-全国教师公开招聘与备考助手-v6.1.md)：当前只开放语文学科，主线为**机会发现 → 可解释资格匹配 → 关注与报名日程 → 主要目标 → 备考**。

> **当前状态（2026-10-04）：只有启动骨架。** 业务接口、公告流水线、匹配、关注、日程、真实认证均未实现；本 README 中“v6.1 计划承担”一节描述的是目标，不是已有能力。

## 技术栈

- NestJS 12（ESM，`"type": "module"`）
- Prisma 6 + PostgreSQL
- Vitest 4（单测 + e2e，supertest）
- Docker（多阶段构建，`node:24-alpine`）

## 当前实现

| 文件 | 内容 |
|---|---|
| `src/main.ts` | 应用启动；按 `CORS_ORIGINS`（逗号分隔）开启 CORS；监听 `PORT`（默认 3000） |
| `src/health.controller.ts` | `GET /health`：执行 `SELECT 1`，返回 `{ status, db, time }`；数据库不可用时返回 `degraded` |
| `src/app.controller.ts` / `app.service.ts` | Nest 模板遗留的 `GET /`（返回 `Hello World!`），后续业务模块接入后可移除 |
| `src/internal-token.guard.ts` | 全局守卫：校验请求头 `x-internal-token` 与环境变量 `INTERNAL_TOKEN` 一致（`timingSafeEqual` 常量时间比较）；未设置该环境变量时放行，便于本地开发 |
| `src/prisma.service.ts` | PrismaClient 封装 |
| `prisma/schema.prisma` | 目前只有一张 `User` 表（id / email / name / role / 时间戳） |
| `prisma/migrations/20261002062744_init` | 初始迁移 |

前端通过 Next.js 服务端同源反代（`/api/*`）调用本服务，由反代注入 `x-internal-token`；浏览器不直接访问后端端口。公开演示环境（纯 localStorage Mock）不依赖本服务。

## 本地开发

```bash
cd backend
npm install

# 准备 PostgreSQL，然后配置环境变量（见 .env.example）
# DATABASE_URL=postgresql://kaobian:CHANGE_ME@localhost:5432/kaobian
npx prisma migrate dev      # 应用迁移（首次）

npm run start:dev           #  watch 模式
curl http://localhost:3000/health
```

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | 是 | PostgreSQL 连接串；模板见 `.env.example`（该文件含本地 SSH 隧道示例） |
| `PORT` | 否 | 监听端口，默认 3000；现网部署可按安全组规划使用其他端口 |
| `HOST` | 否 | 监听地址，默认 `0.0.0.0`（兼容容器）；Nginx 同机裸进程部署设 `127.0.0.1`，使后端不对公网暴露 |
| `TRUST_PROXY` | 反代部署时必填 | 设为 `true` 时信任一层反向代理的 `X-Forwarded-*`（Nginx 终止 TLS 场景） |
| `CORS_ORIGINS` | 否 | 允许跨域来源，逗号分隔；默认 `http://localhost:3000`；受邀环境填备案产品域名 |
| `INTERNAL_TOKEN` | 部署时必填 | 内部反代密钥；未设置时守卫放行，**仅限本地开发**，受邀/正式环境必须设置强随机值 |

真实密钥只能通过部署平台环境变量或 Secret 管理注入，不提交仓库、不写入日志、不进入前端。

## 测试与构建

```bash
npm test          # 单元测试
npm run test:e2e  # e2e（当前覆盖 GET / 返回 Hello World!）
npm run lint      # oxlint
npm run build     # nest build
```

Docker 构建：`docker build -t kaobian-backend .`，产物以 `node dist/main.js` 启动，暴露端口以 `PORT` 为准。

## v6.1 计划承担的后端能力（尚未实现）

下列模块按 [`docs/v6.1-migration-plan.md`](../docs/v6.1-migration-plan.md) 的阶段落地，字段与状态机细节见 [`docs/v6.1-data-pipeline.md`](../docs/v6.1-data-pipeline.md)。受邀验证阶段保持**模块化单体**，不拆微服务。

1. **公告与报考单元**：招聘公告、公告版本（不可变发布）、报考单元（区县/岗位组/具体学校）、用工性质官方名称、分配方式、补充公告关系；当前只有 `User` 单表，需新增模型与迁移。
2. **证据与版本留痕**：来源、原始快照（含 SHA-256 与对象存储地址）、字段级证据锚点（页码/工作表/单元格/原文片段）、审核记录；高影响字段经人工审核后才能进入 published 版本。
3. **提取与审核**：管理员提交 URL/正文/附件 → 快照留档 → 确定性解析与 AI 候选提取（仅候选）→ 自动校验 → 人工审核 → 发布。首版用数据库任务表 + 手动触发/轮询，**不引入 Redis、BullMQ、Kafka**；AI/OCR 经后端适配器调用境内可访问服务，密钥不出服务端。
4. **用户画像**：五组基础画像与按需补充条件（年龄、户籍、社保、经历仅在机会需要时收集）；访客可先体验，登录后幂等迁移。
5. **资格匹配**：逐条件四值结果（PASS / FAIL / UNKNOWN / MANUAL_REVIEW）与四档总结果（初步符合 / 补充信息后判断 / 建议人工确认 / 明确不符合）；结论关联公告版本、规则版本与证据；规则集中在独立规则层，匹配按请求即时计算，不做批量队列。
6. **关注与报名推进**：关注状态（考虑中 / 准备报名 / 已报名 / 已放弃 / 已结束）、报名材料清单、主要/备选目标标记。
7. **时间线与提醒**：从已发布公告版本派生报名、审核、缴费、准考证、笔试、成绩等事件；唯一键防重复，时间待定显示“待官方通知”；首版只做站内事件，不接短信、微信、邮件或 Web Push。
8. **备考（对接现有前端规则）**：主要目标确认后才允许生成 7 天计划；考试内容未确认时不生成伪精确计划。
9. **受邀账号与权限**：管理员预建账号、安全哈希密码、HttpOnly 会话；所有管理权限在服务端校验，前端隐藏按钮不构成安全边界；正式模式不得静默回退 Mock。

## 边界（本轮明确不做）

- 不做自动全国爬虫、定时采集调度平台；
- 不引入 Redis/BullMQ、Kafka、Elasticsearch、向量数据库、Kubernetes；
- 不做自动代报名、简历投递、招聘单位聊天；
- 不用 AI 直接判定资格、推测缺失字段或预测录取概率；
- 权限、输入校验、审计与数据隔离必须在服务端/数据库层执行。
