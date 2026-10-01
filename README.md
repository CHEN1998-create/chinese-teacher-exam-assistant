# 全国语文教师编备考助手 - 用户端前端

这是一个面向语文教师编备考用户的个人备考助手前端骨架，基于 Next.js App Router + TypeScript + Tailwind CSS 构建。

## 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS 4
- **组件库**: 自定义组件
- **数据**: 本地 Mock 数据 + localStorage 持久化

## 启动项目

```bash
cd frontend
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看页面。

## 页面与路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/login` | 登录 | 演示账号登录（Demo 认证，非真实鉴权） |
| `/onboarding` | 目标澄清 | 四种目标状态入口、创建目标（确认/草稿）、填写目标考试信息（需登录） |
| `/exam` | 我的考试 | 当前主目标卡、澄清任务、历史目标切换/编辑/归档/重新启用、公告提交（链接/文本/文件占位）、考情画像（11 字段证据卡）、待确认与纠错（需登录） |
| `/materials` | 资料与资源 | 管理备考资料、查看诊断结果、发现缺少模块（需登录） |
| `/plan` | 本周计划 | 查看7天计划、每日任务、调整说明；目标未澄清时显示门禁提示（需登录） |
| `/today` | 今天与复盘 | 查看今日任务、提交执行反馈；目标未澄清时显示门禁提示（需登录） |
| `/settings` | 设置与数据 | 账号信息、修改学段/每日时间/通知偏好、退出登录（需登录） |
| `/admin` | 运营后台 | 考情/资源审核等占位页，仅工作人员角色可访问 |

## 账号与会话（当前为 Demo 实现，非真实认证）

> **重要说明**：本项目目前只有前端，**没有后端、数据库和真实鉴权**。
> 登录为 **Demo 模拟实现**：账号在本地明文比对，会话保存在浏览器 localStorage。
> 它只用于产品原型演示和前端联调，**不提供任何安全保障，不可用于生产环境**。

### 演示账号

所有演示账号密码均为 `demo1234`：

| 账号 | 角色 | 用途 |
|------|------|------|
| `student@demo.app` | 备考用户（user） | 普通用户，不能进入后台 |
| `exam@demo.app` | 考情审核员（exam_reviewer） | 可进入后台 |
| `resource@demo.app` | 资源审核员（resource_reviewer） | 可进入后台 |
| `admin@demo.app` | 管理员（admin） | 可进入后台 |

登录页提供一键填充按钮。会话有效期 7 天，**刷新页面后自动恢复**；过期后会提示“会话已失效”并跳回登录页。

### 架构：认证逻辑 / 用户状态 / UI 三层分离

```
src/lib/auth/
├── types.ts           # Session、UserRole、AuthCredentials、AuthService 接口
├── demo-accounts.ts   # 4 个演示账号定义
├── DemoAuthProvider.ts# AuthService 的 Demo 实现（本地校验 + localStorage 会话）
├── instance.ts        # 当前生效的认证服务单例（替换真实认证的唯一位置）
├── AuthContext.tsx    # 客户端会话状态：useCurrentUser() / useAuth()
└── index.ts           # 统一导出
```

- **页面不直接读写用户对象**，一律通过 `useCurrentUser()` 获取当前用户、角色和资料修改能力。
- 路由保护：`src/components/auth/RequireAuth.tsx` 提供 `RequireAuth`（未登录跳 `/login?next=...`）和 `RequireRole`（角色不足显示权限不足状态）。
- 用户基础资料包含：用户ID、昵称、角色、学段、每日可用学习时间、学习提醒时间、通知偏好，可在 `/settings` 修改并持久化到会话。

### 以后如何替换为真实认证（无需改动页面）

1. 新建 `src/lib/auth/HttpAuthProvider.ts`，实现 `src/lib/auth/types.ts` 中的 **同一个 `AuthService` 接口**（login / logout / restoreSession / getSession / updateProfile / subscribe），内部改为调用真实后端 API、使用 httpOnly Cookie 或标准 token 机制；
2. 打开 `src/lib/auth/instance.ts`，将 `new DemoAuthProvider()` 替换为 `new HttpAuthProvider()`；
3. 页面和组件继续使用 `useCurrentUser()`，**不需要任何改动**。

本次明确**不包含**：短信、邮件验证码、找回密码真实流程、第三方 OAuth、生产级账号安全系统。

## 目标澄清与目标考试

帮助用户先明确“正在准备哪一次考试”。信息不足时只生成澄清任务，**不生成看似精确的学习计划**。

### 四种目标状态（onboarding 入口）

| 状态值 `targetStatus` | 含义 | 确认后结果 |
| ------ | ------ | ------ |
| `announcement` | 已有明确公告 | 省份 + 公告链接齐全即满足门禁，直接进入已确认 |
| `region` | 已确定地区但暂无公告 | 省份 + 城市/招聘单位/批次任一齐全即满足门禁 |
| `candidates` | 有几个候选地区或学段 | 保存候选后进入澄清，在 `/exam` 确认一个“本周准备方向”后满足门禁 |
| `subject` | 只确定了语文学科 | 始终为澄清中，由查找任务引导补充信息 |

### 目标考试字段与生命周期

`ExamTarget` 字段：省份、城市、招聘单位（recruiter）、招聘类型（examType）、年份或批次、学段、学科（固定语文）、考试阶段、目标状态、候选列表、公告链接、澄清任务。

生命周期（由字段自动派生，非手工维护）：

- **澄清中（draft）**：未满足进入条件，页面只展示澄清任务
- **已确认（confirmed）**：满足门禁，可进入考情核验与计划页
- **已归档（archived）**：不再准备，保留在历史中，可“重新启用”

一个用户可保存任意多个目标，**同一时间只有一个当前主目标**；支持创建、编辑、切换、归档、重新启用。新建目标（含草稿）自动成为主目标，旧主目标保留在历史中。

### 门禁规则（唯一真值来源：`src/lib/targets/domain.ts`）

`canGeneratePlan()` / `canEnterVerification()` 满足以下**任意一项**才允许生成完整计划 / 进入考情核验：

1. 已提供目标考试公告（`announcement` + 公告链接）；
2. 明确目标省份且有城市 / 招聘单位 / 招聘批次；
3. 从候选目标中确认了一个本周准备方向。

否则 `/plan`、`/today` 显示“请先完成目标澄清”空状态，不展示任何精确复习比例。页面与 service **不得自行复制门禁判断**，统一调用 domain 函数。

### 信息不足时的输出

`buildClarification(target)` 输出三部分：

- **已确定条件**：从已填字段提取（如 学科：语文、省份：浙江省）
- **待确认问题**：缺失的省份、学段、批次等问题清单
- **查找任务**：1–3 个可勾选任务（查找公告、确认地区/单位/批次、比较候选方向等），任务 id 稳定（`${targetId}#${seed.key}`），编辑目标后已完成任务不丢失

### 架构与存储

```
src/lib/targets/
├── domain.ts                    # 纯领域逻辑：门禁、校验、澄清任务派生（无 React、无存储）
└── useCurrentExamTarget.ts     # useCurrentExamTarget / useExamTargets（useSyncExternalStore 订阅）
src/components/targets/
├── TargetForm.tsx               # onboarding 与编辑弹窗共用表单
└── ClarificationPanel.tsx       # 信息不足时的澄清视图
```

- `examTargetService`（`src/lib/services.ts`）负责目标 CRUD、切换、归档与澄清任务；写入失败时由 `saveToStorageStrict` 抛错，页面显示错误提示且不静默吞掉。
- 数据存 localStorage `kb_exam_targets`（按账号 userId 隔离，不覆盖他人数据），当前主目标指针存会话 `kb_session.user.currentExamTargetId`；刷新后自动恢复。
- service 带版本号订阅机制（`subscribe` / `getVersion`），切换、编辑、勾选任务后侧边栏、`/exam`、`/plan`、`/today` 自动同步，无需手动刷新。
- Mock 种子见 `src/lib/mock-data.ts`：`student@demo.app` 预置一个已确认的杭州目标与一个已归档的南京目标；其他账号首次进入没有目标，用于演示“首次进入”状态。

### 如何验证各目标状态

1. **首次进入**：用 `exam@demo.app` 登录（或设置页清除个人数据后重登），访问 `/exam`，显示“先明确你正在准备哪一次考试”。
2. **信息填写中**：`/onboarding` 选“只确定了语文学科” → 保存草稿 → 目标卡显示黄色“澄清中”。
3. **信息不足**：上一步之后 `/exam` 显示橙色澄清条 + 已确定条件 + 待确认问题 + 1–3 个查找任务；`/plan`、`/today` 被“请先完成目标澄清”拦截；勾选任务后立即标记已完成。
4. **已确认主目标**：四种入口任意一种满足门禁后徽标变绿“已确认”，出现证据卡与“进入考情核验”按钮；`/plan` 正常展示。
5. **目标已归档**：历史目标中点“归档”，目标变灰且不能设为当前；当前主目标自动转移；“重新启用”可恢复。
6. **保存失败/校验拦截**：公告入口不填省份与链接点确认，页面出现红色错误条且不跳转（“还缺少：省份、公告链接，可以先保存草稿稍后补充”）。
7. **切换与持久化**：历史中点“设为当前”，侧边栏摘要立即变化；F5 后状态保持；编辑弹窗自动回填已有信息，无需重复填写。

本次明确**不包含**：公告真实抓取/真实 AI 解析、考情人工审核后台、计划自动生成。

## 公告提交与考情证据

用户在 `/exam`（目标满足门禁后）提交公告或来源信息，系统生成**结构化考试画像**，并明确区分每一条结论的证据状态。

### 公告输入三入口（“提交公告”标签页）

| 入口 | 当前实现 | Mock 边界 |
| ---- | ---- | ---- |
| 公告链接 | 校验 `http(s)://` 后进入异步提取 | **不抓取网页**：按已确认目标生成“模拟提取”模板，每条摘录明确标注“模拟提取：演示环境不会真实访问链接内容”；URL 含 `fail/error/404/invalid` 时模拟失败 |
| 文本粘贴 | **浏览器本地规则识别**（日期句式、`《》`科目名、分值/资格/范围关键词句），提供“填入示例公告” | 非 AI：纯正则/关键词规则；识别不到的字段不返回、绝不编造；正文少于 10 字或未识别到任何字段时报失败 |
| 文件上传 | 虚线占位框，可选择 PDF/图片/Word 并显示文件名 | **仅占位**：不读取、不上传、不解析文件内容；service 层直接拒绝并提示改用链接或文本 |

### 提取流程五状态（`ExtractionJobStatus`）

`idle` 未提交（空面板提示）→ `processing` 正在提取（进度 18/46/74/92/100% + 阶段文案）→ `succeeded` 提取成功 / `failed` 提取失败（显示失败原因 + “重新提取”）/ `pending_review` 提取成功但含待人工审核字段。

- 异步任务带进度回调、失败原因、重试入口（`retryJob` 使用原来源重新提取）；
- **同一目标任务互斥**，进行中再次提交会被拦截；失败时不改动任何已有证据；
- 提取中刷新页面：残留的 `processing` 任务在下次加载时落为 `failed`，原因“页面刷新或会话中断导致提取未完成，请重新提取”，不假装成功。

### 考试画像 11 个字段（`EvidenceType`）

地区/招聘单位、招聘类型、年份/批次、学段、考试阶段（基本信息组）；报名时间、考试时间、考试科目、分值、资格条件（**高影响字段组**）；考试范围（范围组）。

### 六种审核状态（`ReviewStatus`）与关键规则

| 状态 | 含义 | 谁可以写入 |
| ---- | ---- | ---- |
| `ai_extracted` AI已提取 | AI/规则提取的低影响字段 | 仅提取流程 |
| `pending_review` 待审核 | AI/规则提取的**高影响字段**，等待人工审核 | 仅提取流程 |
| `official` 官方确认 | 经人工审核确认的官方事实 | **仅人工审核后台/种子数据，本版本无审核入口** |
| `historical` 历史经验 | 往年公告等历史来源 | 种子数据/未来人工录入 |
| `personal` 个人经验 | 用户个人经验 | 种子数据/未来人工录入 |
| `unconfirmed` 待确认 | 没有来源、来源冲突或字段缺失时的占位 | 画像层即时生成，不落库 |

规则：

1. **AI 提取结果永远只会是 `ai_extracted` 或 `pending_review`**（`reviewStatusForExtracted()`），代码中没有任何路径让提取结果自动变成官方确认；
2. 未经人工审核绝不显示“官方确认”——当前 `official` 仅来自 `mockEvidenceItems` 种子（3 条，带审核人与确认时间）；
3. 没有来源、多来源结论冲突、字段缺失时显示“待确认”，并在“待确认与纠错”标签集中列出；
4. 报名/考试时间、科目、分值、资格条件为**高影响字段**，画像中加“高影响”标记、黄色边框重点展示，顶部有高影响待审核警告；
5. 同字段多来源不同值时标“来源冲突”（红框 + 其他来源结论对照），可信度优先级：官方确认 > 个人经验 > 历史经验 > 待审核 > AI已提取 > 待确认。

每条证据卡展示：**结论值、审核状态徽标、证据标签（高影响/冲突）、原始来源（可点“打开原始来源 ↗”）、适用范围、更新时间、审核人与人工确认时间、原文摘录、提交纠错按钮**。

### 纠错

弹窗中字段自动带入当前行（也可在“待确认与纠错”里对任意字段新增）；“正确内容”和“纠错原因”必填（空值红色校验拦截），佐证链接选填。提交后持久化为 `pending` 待处理并出现在“我的纠错”列表，**纠错不会自动修改证据**（本版本没有处理队列，仅持久化）。

### 按目标隔离

证据、提取任务、纠错全部带 `examTargetId`（且按账号 `userId` 隔离）；`useEvidence(target)` 只订阅、只读取当前目标。切换主目标时画像、任务历史、纠错列表立即切换，南京目标看不到杭州的任何证据。

### 文件结构与真实对接

```
src/lib/evidence/
├── domain.ts          # 纯领域逻辑：字段分组/高影响清单/状态归属/合并/冲突/画像行（无 React、无存储）
├── extractor.ts       # EvidenceExtractor 接口 + mockEvidenceExtractor（本地模拟/规则，无网络无 AI）
├── evidenceService.ts # 任务流转、证据存取、纠错、订阅、刷新中断判定（对象字面量单例）
└── useEvidence.ts     # useSyncExternalStore 订阅式读取当前目标的证据/任务/纠错
src/components/evidence/
├── EvidenceProfile.tsx       # 11 字段画像 + 状态摘要 + 冲突/高影响展示
├── AnnouncementSubmitForm.tsx# 三入口提交表单
└── ExtractionJobPanel.tsx    # 进度/失败/重试/待审核状态与历史任务
```

localStorage 键：`kb_evidence_items`、`kb_extraction_jobs`、`kb_corrections`。

**替换为真实服务（页面无需改动）两种方式：**

1. 新增 `HttpEvidenceExtractor` 实现 `EvidenceExtractor` 接口（`extract(input, {target}, onProgress)`，内部调用真实抽取 API 并回报进度），在应用初始化处调用 `evidenceService.setExtractor(new HttpEvidenceExtractor())`；
2. 或整体替换 `evidenceService`（保持 `getItems/getJobs/getLatestJob/startExtraction/retryJob/getCorrections/submitCorrection/subscribe/getVersion` 等签名）。

人工审核后台就绪后，审核通过动作写入 `reviewStatus: "official"` + `reviewerName` + `reviewedAt`，画像即显示官方确认；前端不需要改动。

本次明确**不包含**：真实 AI 解析、网页抓取、文件 OCR/解析、人工审核入口与纠错处理流、真实资格判断、上岸概率、高影响事实自动确认、全国公告自动抓取。

### 如何验证各状态

1. 用 `student@demo.app` 登录（或设置页清除数据后重登）进入 `/exam`：初始画像 3 条绿色“官方确认”（科目/范围/资格，带审核人）、1 条“历史经验”（报名时间）、其余 7 条“待确认”，每条有来源/范围/更新时间；
2. “提交公告 → 文本粘贴 → 填入示例公告 → 提交”：进度动画结束后任务为“待人工审核”；画像中 5 个高影响字段为黄色“待审核”，低影响字段为蓝色“AI已提取”，报名时间出现历史 vs 新来源的“来源冲突”对照，**没有任何新结论自动变官方确认**；
3. “公告链接”输入含 `fail` 的 URL（如 `https://example.com/fail`）：进度走完后显示失败原因与“重新提取”；粘贴少于 10 字的文本同样失败；
4. 提取进行中立刻刷新页面：任务变为失败“页面刷新或会话中断…”，点“重新提取”可成功；
5. “文件上传”页签：琥珀色占位提示，不真实读取文件；
6. 任意证据卡点“提交纠错”：空提交被校验拦截；填写后出现在“待确认与纠错 → 我的纠错”（待处理）；
7. 历史目标中“重新启用”南京目标：画像 11 字段全部待确认、无杭州证据与任务；切回杭州后证据完整恢复。

## 目录结构

```
src/
├── app/                    # 页面路由
│   ├── onboarding/         # 目标澄清页
│   ├── exam/               # 我的考试页
│   ├── materials/          # 资料与资源页
│   ├── plan/               # 本周计划页
│   ├── today/              # 今天与复盘页
│   ├── settings/           # 设置页
│   ├── login/              # 登录页
│   ├── admin/              # 运营后台（占位，角色保护）
│   ├── layout.tsx          # 全局布局（挂载 AuthProvider）
│   └── page.tsx            # 首页（重定向）
├── components/
│   ├── auth/               # 认证相关
│   │   └── RequireAuth.tsx # RequireAuth / RequireRole 路由守卫
│   ├── ui/                 # 可复用UI组件
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── Tabs.tsx
│   │   ├── Progress.tsx
│   │   ├── Switch.tsx
│   │   ├── Loading.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ErrorState.tsx
│   │   ├── MaterialCard.tsx
│   │   ├── ResourceCard.tsx
│   │   ├── TaskCard.tsx
│   │   └── FeedbackForm.tsx
│   ├── targets/            # 目标澄清模块
│   │   ├── TargetForm.tsx        # onboarding/编辑共用表单（四种状态入口）
│   │   └── ClarificationPanel.tsx# 信息不足时的澄清视图
│   ├── evidence/           # 公告提交与考情证据模块
│   │   ├── EvidenceProfile.tsx       # 11 字段画像与证据卡
│   │   ├── AnnouncementSubmitForm.tsx# 公告链接/文本/文件三入口
│   │   └── ExtractionJobPanel.tsx    # 提取进度/失败/重试/历史
│   └── layout/             # 布局组件
│       ├── AppShell.tsx
│       ├── Sidebar.tsx
│       ├── BottomNav.tsx
│       └── Header.tsx
├── lib/
│   ├── auth/               # 认证模块（Demo 实现，见上方说明）
│   ├── targets/            # 目标澄清领域逻辑与订阅 hook
│   │   ├── domain.ts       # 门禁/校验/澄清任务派生（唯一真值来源）
│   │   └── useCurrentExamTarget.ts
│   ├── evidence/           # 考情证据领域逻辑、Mock 提取器、服务与订阅 hook
│   │   ├── domain.ts       # 字段分组/高影响/状态归属/合并冲突（纯函数）
│   │   ├── extractor.ts    # EvidenceExtractor 接口 + Mock 提取器
│   │   ├── evidenceService.ts
│   │   └── useEvidence.ts
│   ├── mock-data.ts        # Mock数据
│   ├── services.ts         # 数据服务层（当前用户从会话读取）
│   ├── storage.ts          # 本地存储工具（含严格写入 saveToStorageStrict）
│   └── utils.ts            # 工具函数
└── types/
    └── index.ts            # TypeScript类型定义
```

## Mock数据位置

所有 Mock 数据集中在 `src/lib/mock-data.ts`，包括：

- 用户信息
- 目标考试
- 考情证据种子（`mockEvidenceItems`：3 条官方确认 + 1 条历史经验）与示例公告文本（`SAMPLE_ANNOUNCEMENT_TEXT`）
- 用户资料
- 公共资源
- 周计划与每日任务
- 用户设置

数据通过 `src/lib/storage.ts` 进行 localStorage 持久化，刷新页面后数据不会丢失。

## 接入真实接口

当需要接入真实后端时，只需修改 `src/lib/services.ts` 中的服务方法：

```typescript
// 修改前（Mock）
export const examTargetService = {
  getCurrent(): ExamTarget | null {
    const targets = loadFromStorage(STORAGE_KEYS.EXAM_TARGETS, mockExamTargets);
    return targets.find((t) => t.isCurrent) || null;
  },
};

// 修改后（真实API）
export const examTargetService = {
  async getCurrent(): Promise<ExamTarget | null> {
    const res = await fetch("/api/exam-targets/current");
    return res.json();
  },
};
```

## 新增业务模块

1. **添加类型**：在 `src/types/index.ts` 中定义数据类型
2. **添加Mock数据**：在 `src/lib/mock-data.ts` 中添加数据
3. **添加服务方法**：在 `src/lib/services.ts` 中创建对应服务
4. **创建页面**：在 `src/app/` 下创建对应路由文件夹和 `page.tsx`
5. **更新导航**：在 `src/components/layout/Sidebar.tsx` 和 `BottomNav.tsx` 中添加导航项

## 当前Mock/占位功能

以下功能为演示状态，尚未实现真实逻辑：

- **目标考试数据**: 目标的创建/切换/归档/澄清任务均为本地 Mock + localStorage 持久化，非真实接口（service 已独立封装，页面不含数据逻辑）
- **公告提取与考情证据**: 已有完整的提交→异步提取（进度/失败/重试/待审核）→字段画像→纠错演示链路，但**没有真实 AI/后端**：链接来源不抓取网页（按目标模拟并明确标注“模拟提取”），文本来源为浏览器本地正则/关键词规则识别，文件上传仅占位，人工审核未实现（“官方确认”仅种子数据）。替换点 `evidenceService.setExtractor()`，详见上方“公告提交与考情证据”章节
- **AI资料诊断**: 诊断结果基于预置Mock数据
- **计划自动生成**: 7天计划为固定Mock数据；且**仅在目标满足门禁后展示**，未澄清时显示“请先完成目标澄清”
- **智能重排**: 第4天重排和第7天复盘为静态展示
- **资源匹配**: 推荐资源基于固定规则，非AI计算
- **登录鉴权**: 已有登录/会话/角色与路由保护，但是 **Demo 模拟实现**（本地校验 + localStorage），不是真实安全认证
- **管理后台**: 仅有角色保护下的占位框架，审核业务逻辑未实现

## 模块变更记录

| 日期 | 模块 | 变更 |
| ---- | ---- | ---- |
| 2026-10-01 | 前端骨架 | 初始化 Next.js 16 App Router + React 19 + TS + Tailwind 4 骨架与静态页面 |
| 2026-10-01 | 账号、会话与基础资料 | Demo 认证（登录/会话恢复/角色/路由保护）、设置页资料修改、AuthService 三层分离 |
| 2026-10-02 | 目标澄清与目标考试 | 新增四种目标状态入口与 `ExamTarget`/`TargetStatus`/`ClarificationTask` 类型；新增 `src/lib/targets/domain.ts` 门禁与澄清任务领域逻辑；`examTargetService` 支持多目标创建/编辑/切换/归档/重新启用与订阅式刷新；`/onboarding`、`/exam` 重写，`/plan`、`/today` 增加目标门禁，侧边栏/顶栏展示当前主目标摘要；数据本地 Mock + localStorage 按账号隔离。不含公告解析、人工审核、计划生成 |
| 2026-10-02 | 公告提交与考情证据 | 新增 `EvidenceType`（11 字段）/`ReviewStatus`（6 状态）/`EvidenceItem`/`ExtractionJob`/`ExtractionJobStatus` 类型与 `src/lib/evidence/`（domain 纯函数、可替换 `EvidenceExtractor` + Mock 提取、evidenceService、useEvidence）及 `src/components/evidence/` 三个组件；`/exam` 改造为考情画像/提交公告/待确认与纠错三标签；三入口（链接模拟/文本本地规则/文件占位）、五状态任务（进度/失败原因/重试/刷新中断判定）、高影响字段强制待审核、AI 结论永不自动官方确认、来源冲突对照、纠错持久化、证据按目标+账号隔离；official 仅种子数据。不含真实 AI/抓取/文件解析/人工审核/资格判断/上岸概率 |

## 构建与部署

```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

## 设计原则

- 安静、可信、清晰，适合教育和备考场景
- 浅色背景 + 蓝色/绿色主色调
- 卡片层次清楚，重要信息突出
- 不使用排行榜、连续打卡、惩罚性文案
- 状态不仅依靠颜色，还使用文字和图标
- 优先适配手机，同时保证桌面端可用
