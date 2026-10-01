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
| `/materials` | 资料与基线 | 资料状态三入口、私有资料 CRUD、能力基线自评、规则层诊断（继续/部分/暂缓/缺口）、缺口公共资源匹配（每缺口最多 3 个）、公共资源只读浏览（需登录） |
| `/plan` | 本周计划 | 查看7天计划、每日任务、调整说明；目标未澄清时显示门禁提示（需登录） |
| `/today` | 今天与复盘 | 查看今日任务、提交执行反馈；目标未澄清时显示门禁提示（需登录） |
| `/settings` | 设置与数据 | 账号信息、修改学段/每日时间/通知偏好、退出登录（需登录） |
| `/admin` | 运营后台概览 | 后台模块入口与队列计数，仅工作人员角色可访问 |
| `/admin/exams` | 考情与证据管理 | 跨用户查看全部目标的证据状态统计，跳转审核（需工作人员角色） |
| `/admin/reviews` | 考情审核队列 | 五队列审核 AI 提取结论、处理来源冲突、查看历史版本与操作留痕（需工作人员角色） |
| `/admin/resources` | 公共资源管理 | 资源新增/编辑/停用/复核、来源与权利状态维护、待复核与已失效队列、查看/加计划统计（资源审核员与管理员可写，其他工作人员只读） |

## 账号与会话（当前为 Demo 实现，非真实认证）

> **重要说明**：本项目目前只有前端，**没有后端、数据库和真实鉴权**。
> 登录为 **Demo 模拟实现**：账号在本地明文比对，会话保存在浏览器 localStorage。
> 它只用于产品原型演示和前端联调，**不提供任何安全保障，不可用于生产环境**。

### 演示账号

所有演示账号密码均为 `demo1234`：

| 账号 | 角色 | 用途 |
|------|------|------|
| `student@demo.app` | 备考用户（user） | 普通用户，不能进入后台 |
| `exam@demo.app` | 考情审核员（exam_reviewer） | 可审核全部考情字段（含高影响字段） |
| `resource@demo.app` | 资源审核员（resource_reviewer） | 可浏览考情队列，仅能审核低影响字段，高影响字段锁定 |
| `admin@demo.app` | 管理员（admin） | 可审核全部字段并查看所有操作留痕 |

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

人工审核能力已由“考情审核后台”模块提供（见下一节）：审核通过写入 `reviewStatus: "official"` + `reviewerName` + `reviewedAt`，画像即显示官方确认；驳回/标记后用户端显示待确认，用户端代码无需感知审核动作。

本次明确**不包含**：真实 AI 解析、网页抓取、文件 OCR/解析、纠错处理流、真实资格判断、上岸概率、高影响事实自动确认、全国公告自动抓取、大范围错误撤回（后续治理模块）。

### 如何验证各状态

1. 用 `student@demo.app` 登录（如之前用过旧版本，先在 `/settings` 清除全部本地数据后重登）进入 `/exam`：初始画像 3 条绿色“官方确认”（科目/范围/资格，带审核人）、报名时间主结论为“历史经验”并附 2026 年新来源备选、考试时间/分值为黄色“待审核”（分值带红色“来源冲突”）、学段为蓝色“AI已提取”，其余字段“待确认”；
2. “提交公告 → 文本粘贴 → 填入示例公告 → 提交”：进度动画结束后任务为“待人工审核”；画像中新提取的高影响字段为“待审核”，低影响字段为“AI已提取”，**没有任何新结论自动变官方确认**；
3. “公告链接”输入含 `fail` 的 URL（如 `https://example.com/fail`）：进度走完后显示失败原因与“重新提取”；粘贴少于 10 字的文本同样失败；
4. 提取进行中立刻刷新页面：任务变为失败“页面刷新或会话中断…”，点“重新提取”可成功；
5. “文件上传”页签：琥珀色占位提示，不真实读取文件；
6. 任意证据卡点“提交纠错”：空提交被校验拦截；填写后出现在“待确认与纠错 → 我的纠错”（待处理）；
7. 历史目标中“重新启用”南京目标：画像 11 字段全部待确认、无杭州证据与任务；切回杭州后证据完整恢复。

## 考情审核后台（当前为本地 Mock，非生产实现）

> **非生产说明**：本模块没有真实后端，队列数据、权限判定、审核留痕全部保存在浏览器
> localStorage，可被用户自行改写，**不能作为生产级权限控制或审计系统**。
> 真实环境须由服务端鉴权、持久化审核记录并防篡改。服务层 `AdminReviewService`
> 保持可整体替换为 HTTP 实现的方法签名，页面无需改动。

### 路由与入口

- `/admin/exams`：跨用户查看全部目标考试的证据状态统计（官方确认/待审核/AI已提取/待确认/冲突数），“去审核”带 `?target=` 跳转到该目标的队列；
- `/admin/reviews`：五个审核队列 + 审核详情主从面板 + 最近审核记录。

### 五个审核队列

| 队列 | 内容 |
|------|------|
| 待审核 | `pending_review`（高影响，必须人工审核）与可复核的 `ai_extracted` 结论 |
| 高风险优先 | 待办中按 高影响字段 > 来源冲突 > 即将过期 排序置顶 |
| 来源冲突 | 同字段存在不同来源、不同值的事实结论，或被审核员手动标记冲突；冲突**不会被静默覆盖** |
| 即将过期 | 报名/考试时间在未来 45 天内的有效结论（阈值见 `EXPIRING_WINDOW_DAYS`） |
| 已完成 | 已官方确认或存在终态审核记录（驳回/待确认/冲突/修改后通过）的结论 |

### 五种审核动作（原因必填）

| 动作 | 用户端结果 | 版本规则 |
|------|-----------|---------|
| 通过 | “官方确认”，值不变 | 版本不变 |
| 修改后通过 | “官方确认”，值=审核员校正值 | **已发布结论被修改时版本号 +1**，旧值进入历史记录；首次发布不升版本 |
| 驳回 | “待确认”，原值保留仅供留痕 | 版本不变，该结论退出画像主结论 |
| 标记待确认 | “待确认” | 版本不变 |
| 标记来源冲突 | “待确认” + 红色来源冲突标记，直到冲突被处理 | 版本不变 |

每次操作必须**选择预置原因**（可再补充说明），并不可变追加一条 `ReviewLog`：
审核人 ID/姓名/角色、审核时间、动作、原因、修改前后的值与状态、版本号。
详情页提供：原始来源（名称/链接/原文摘录）、AI 提取值、当前发布值、适用范围、同字段全部来源、历史版本时间线。

### 权限（路由守卫 + service 操作级校验，双重）

| 角色 | 进入后台 | 高影响字段动作 | 低影响字段动作 | 查看留痕 |
|------|---------|---------------|---------------|---------|
| user 备考用户 | ✗ 显示权限不足 | ✗ | ✗ | ✗ |
| exam_reviewer 考情审核员 | ✓ | ✓ | ✓ | ✓ |
| resource_reviewer 资源审核员 | ✓（可浏览） | ✗ 按钮锁定并提示需考情审核权限 | ✓ | ✓ |
| admin 管理员 | ✓ | ✓（操作同样留痕） | ✓ | ✓ |

当前账号体系为**单角色制**，“资源审核员同时具有考情审核权限”需在真实账号体系（多角色/权限点）中支持。
审核服务对用户资料/私有数据**只读不写**，结构上保证考情审核员无法修改用户私有资料；
即使绕过 UI 直接调用 `adminReviewService.submitReview()`，service 层仍会抛错。

### 数据联动

审核动作与用户端公告提取写入同一份 `kb_evidence_items`，通过共享事件
（`src/lib/evidence/events.ts`）通知：后台审核后用户端证据卡无需刷新页面即同步；
刷新页面后审核结果、队列状态与留痕从 localStorage 恢复。
画像层冲突口径：已驳回/待确认结论不参与主结论选取；冲突只在官方/待审核/AI已提取
等“当前事实结论”之间计算，历史与个人经验仅作备选展示。

### 文件结构

```
src/lib/admin/
├── domain.ts              # 纯函数：字段级权限、五队列分类/排序、风险与临期判定
├── adminReviewService.ts  # 队列/详情/目标分组/留痕查询 + submitReview（鉴权/原因/版本/事务）
└── useAdminReviews.ts     # useSyncExternalStore 订阅式读取
src/components/admin/
├── ReviewQueue.tsx        # 五队列标签（带计数）+ 结论卡片
├── ReviewDetail.tsx       # 三块对照 + 同字段来源 + 动作表单（必填原因）+ 历史版本
└── AdminExamList.tsx      # 目标证据状态总览
src/app/admin/exams/page.tsx
src/app/admin/reviews/page.tsx
```

localStorage 新增键：`kb_review_logs`（审核留痕，只追加不覆盖）。

### 如何验证（对照验收标准）

1. `exam@demo.app` 登录访问 `/admin/reviews`：五个队列有计数；待审核含考试时间、报名时间、分值、学段；来源冲突队列含“分值”；即将过期含报名时间（2026-11-01）；已完成含预置官方结论；
2. 通过“考试时间 2026年12月13日”（选择原因）→ 详情出现留痕；退出登录换 `student@demo.app`，`/exam` 画像考试时间变为绿色“官方确认”并带审核人/时间；
3. 对分值两条来源：驳回错误的“150分/总分300”来源 → 冲突队列消除；通过“各100分/总分200” → 用户端分值变官方确认；或对单条结论“标记来源冲突”，用户端显示“待确认 · 来源冲突”；
4. 对已官方结论执行“修改后通过”：历史版本出现 v1→v2 与修改前后内容；不选原因时提交按钮禁用；
5. `student@demo.app` 直接访问 `/admin/reviews` 显示权限不足；`resource@demo.app` 进入后高影响字段动作区显示锁定提示，低影响字段（如学段）可审核；
6. 刷新后台与用户端页面：审核结果、队列计数、历史记录全部恢复。

## 资料与能力基线

帮助用户整理已有资料、学习进度、薄弱项和可用时间，针对**当前主目标**输出"继续使用 / 只使用部分章节 / 本周暂不使用 / 当前缺少模块"的诊断。诊断只针对当前主目标；没有任何资料时输出最小资料类别清单。

> **非生产说明**：资料、基线、诊断快照均保存在浏览器 localStorage，按账号 userId 隔离；
> 诊断为本地确定性规则计算，不是 AI、不联网。内置资料均为虚构演示数据，不构成购买建议。

### 页面结构（`/materials`，四个标签）

1. **我的资料**：资料状态三入口（`UsageStatus`：`none` 还没有资料 / `single` 已有一套 / `multiple` 多套不知如何取舍），状态可手选，新增或删除资料后按数量自动同步；支持新增、编辑、删除私有资料。
2. **能力基线**：语文学科 8 模块 + 教综 5 模块 1-5 分自评、最近练习成绩（文本+正确率%）、明显薄弱项手选、每日可用分钟数与每周可用小时数。
3. **诊断结果**：快照式诊断，需手动点击"生成诊断/重新计算"；逐资料给出总体结论、逐模块结论、原因与相关章节、冲突取舍、缺少模块、薄弱模块；无资料时展示最小资料类别清单。
4. **公共资源**：正常且合规公共资源的**只读浏览**列表（与缺口匹配同一道合规闸门），与私有资料分开存储；不做排行或购买。缺口的自动匹配在"诊断结果"标签中展示（见下一章）。

### 资料字段（`MaterialItem`）

名称、来源类型（`MaterialSourceType`：正式出版/机构讲义/个人笔记/公开网络/来源不明扫描件/其他）、作者、出版社/出品方、适用地区、年份、适用学段（可"未标注"）、覆盖模块（可手改）、章节目录（手动维护，支持"根据章节名识别覆盖模块"的关键词预填）、目录是否已核对、学习进度、备注。**不要求上传完整 PDF**；目录识别不确定时允许手动修改标题与模块勾选。

### 诊断规则（唯一真值来源：`src/lib/materials/domain.ts`，纯函数）

- **考情就绪**：高影响五字段（报名/考试时间、科目、分值、资格）全部有官方确认结论才视为考情完整；否则诊断页顶部琥珀横幅提示"考情尚未完全确认，诊断结果可能不完整"并列出待确认字段。官方科目文本含教育综合/教育理论/教育基础/公共基础时，必需模块自动加入教育学、心理学、教育法规。
- **单资料逐模块结论**：来源不明完整扫描件 → 本周暂缓（并明确不能进入公共资源库）；真题/地方政策等地区敏感模块地区不符 → 本周暂缓；地区/学段/年份（差>2 年）不符 → 只用部分章节；资料未覆盖任何当前必需模块 → 本周暂缓。
- **多套取舍**：同一必需模块被多套资料覆盖时，按"地区匹配 > 学段匹配 > 年份 > 来源正规度 > 已有进度"的确定性打分保留一套，其余该模块本周暂缓，并生成冲突说明；打分**仅用于同模块确定性取舍，不用于商业排序、不参考平台热度或合作**。
- **时间约束**：每周可用时间不足 8 小时且多套资料并行时，只保留赢下模块最多的一套。
- **薄弱模块**：手填薄弱项 + 自评 ≤2 分 + 最近成绩正确率 <60% 的并集。
- **缺少模块**：当前必需模块中没有任何"继续/部分"资料覆盖的模块；无资料时输出 5 类最小资料类别（教综教材仅在考情确认含教综科目时必需）。
- **过时提示**：`buildDiagnosisSignature()` 对目标/考情证据/资料/基线计算签名；切换当前目标或任一输入变化后，旧快照签名不匹配，诊断页显示"诊断可能已过时"并引导重新计算（不自动重算）。

### 文件结构

```
src/lib/materials/
├── domain.ts           # 纯规则层：模块目录/关键词预填/归一化/考情就绪/范围匹配/诊断/冲突/薄弱项/签名
├── materialService.ts  # 私有资料 CRUD、基线存取、快照播种与 recompute（对象字面量单例 + 订阅版本号）
└── useMaterials.ts     # useSyncExternalStore 订阅资料/基线/快照/证据/目标/会话
src/components/materials/
├── InventoryStatusPicker.tsx # 资料状态三入口
├── MaterialForm.tsx          # 新增/编辑弹窗（全字段 + 章节手动增删 + 模块勾选 + 扫描件警示）
├── MaterialListItem.tsx      # 资料卡（编辑/删除 + 该项诊断逐模块表）
├── AbilityBaselineForm.tsx   # 自评/成绩/薄弱项/可用时间
├── DiagnosisPanel.tsx        # 诊断快照、冲突、缺口、最小资料类别、过时横幅
└── PublicResourceList.tsx    # 公共资源只读列表
```

localStorage 新增键：`kb_materials`（私有资料，按账号隔离）、`kb_ability_baselines`（能力基线）、`kb_material_diagnoses`（诊断快照）、`kb_public_resources`（公共资源，与私有资料物理分开）。

### 三组内置 Mock 案例（均在 `student@demo.app` 账号下）

| 案例 | 目标（在「我的考试」切换当前主目标体验） | 资料 | 预期诊断要点 |
| ---- | ---- | ---- | ---- |
| 无资料 | 【演示案例·无资料】温州初中 2026 提前批 | 0 份 | 诊断页直接展示最小资料类别清单；入口状态为"还没有资料" |
| 一套适用 | 默认目标：杭州初中 2026 | 1 套浙江专版正式出版资料（2025，覆盖 5 个语文模块，进度 40%） | 总体"继续使用"；考情未确认（报名时间/考试时间/分值等缺官方结论）→ 琥珀横幅；教综模块在缺口中列出 |
| 多套冲突 | 【演示案例·多套冲突】宁波初中 2026 上半年 | 浙江 2026 专版 + 全国通用 2022 机构讲义 + 来源不明押题扫描件 | 同模块保留浙江专版、其余暂缓；扫描件全部模块本周暂缓且警示不进公共资源；通用版真题因地区不符只作部分/暂缓；时间充裕（12h/周）不触发时间收缩 |

首次进入本模块时会按规则层为两个有资料的演示目标播种初始诊断快照；在 `/settings` 清除全部本地数据后可重新播种或体验空状态。

### 如何验证（对照验收标准）

1. 三类入口：在「我的资料」切换"还没有资料/一套/多套"，刷新后选择保持；新增第二份资料后状态自动变为"多套资料"；
2. 资料 CRUD：新增（填名称+章节后点"根据章节名识别覆盖模块"，再手动增删勾）、编辑（章节勾选回填）、删除（二次确认）；刷新后恢复；
3. 逐项诊断：诊断结果中每份资料都有总体结论、逐模块结论与原因；冲突组写明保留哪套、暂缓哪套及原因；
4. 过时提示：修改资料进度/基线后诊断页出现"诊断可能已过时"，点"重新计算"后消失；切换当前主目标后同样提示；
5. 无资料清单：无资料目标的诊断页显示 5 类（或不含教综的 4 类）最小资料类别；
6. 考情横幅：杭州目标因高影响字段未全部官方确认，诊断页与资料页可见"诊断结果可能不完整"；
7. 私有/公共隔离：新增的私有资料不出现在「公共资源」；公共资源列表只读，无购买、排行、加计划入口；扫描件保存后资料卡出现红色来源警示。

本次明确**不包含**：资料购买、完整 PDF 内容解析、课程推荐排行。公共资源与缺口的自动匹配已在下一章实现。

## 公共资源索引与资料缺口匹配

当用户没有资料或现有资料不适用时，为资料诊断识别出的**每个关键缺口**提供最多 3 个来源清楚、适用范围明确的公共资源；没有合规资源时明确显示"暂无已核验资源"与查找建议。

> **非生产说明**：公共资源索引、查看/加入计划记录均保存在浏览器 localStorage（公共资源为全局共享一份，行为记录按账号隔离）；链接有效性、权利状态均为演示数据，真实环境须由服务端定时巡检与鉴权。

### 资源字段（`ResourceItem`，`src/types/index.ts`）

名称、资源类型（`ResourceType`：官方发布/平台自制/开放使用/第三方公开）、来源名称、原始来源链接、权利状态（`RightsStatus`：官方文件/平台自制/已授权/开放授权/第三方公开·仅索引/权利状态不明）、适用地区、年份、适用学段、招聘类型、对应考试模块（`mod_*`）、推荐理由、建议章节、预计使用时间（分钟）、最近复核时间、失效时间（可选）、链接是否可访问、生命周期状态（`ResourceStatus`：正常/已停用/已失效/待复核）、复核人。类型 `PublicResource` 保留为 `ResourceItem` 的 @deprecated 别名，旧数据经 `normalizeResource()` 归一化（旧 license/中文模块名自动映射）。

### 匹配使用哪些字段、按什么顺序过滤

规则唯一真值来源：`src/lib/resources/domain.ts`（纯函数），五层流水线 `matchGapWithTrace()` 会逐层记录丢弃原因（candidateCount/blocked/outOfScope/matches）：

1. **模块候选**：资源的 `modules` 覆盖缺口模块 key；
2. **合规闸门** `checkRecommendable()`：状态必须正常；权利状态不能为"不明"；来源名称/原始链接/对应模块/推荐理由/适用地区/适用学段任一缺失即不强推；链接标记失效、已过 `expiresAt`、最近复核超过 180 天（`REVIEW_STALE_DAYS`）同样不强推；
3. **适用范围** `scopeMatches()`：地区（全国通用；省/市按包含关系）、学段、招聘类型、年份（沿用资料诊断的 `yearFit()`，过期年份淘汰）全部匹配；
4. **排序**：先按权利层级——官方公告/大纲/样题/说明(1) > 平台自制(2) > 已授权/开放使用(3) > 第三方公开原始链接(4)；同层级再按地区贴合度（城市 30/省 20/全国 10）、年份适用 +5、复核新近度 +5 排序。**打分只用于同缺口确定性排序，不做商业排行、不参考平台热度或合作**；
5. **截断**：每个缺口最多 3 条（`MAX_MATCHES_PER_GAP`）。

缺口来源：优先用资料诊断快照的 `missingModules`；尚未诊断（如无资料）时用 `requiredModuleKeys(readiness)` 兜底（教综三模块仅在官方考情确认含教综科目时进入）。

### 用户端（`/materials` → 诊断结果）

每个缺口一张卡（`src/components/resources/GapResourcePanel.tsx`）：资源名称与顺位、权利层级与权利状态 Badge、推荐理由（含来源性质说明）、适用范围摘要、建议章节、预计分钟数、最近复核日期；外链资源提供"查看来源（来源名称）↗"（新标签打开原始链接，点击即写一条查看记录），站内自制资源显示不可点击的站内标识；"加入本周计划"生成一条 `pending_arrangement`（待安排）的 `ResourcePlanLink`，同目标+资源+模块幂等不重复，可"移出计划"；无匹配时显示"暂无已核验资源"空态与 `gapSearchAdvice()` 的查找建议（真题/地方政策模块有专门建议）。"公共资源"Tab 的浏览列表走同一闸门（`listBrowseable()`）。

### 后台（`/admin/resources`）

- 五个队列（由事实自动派生 `classifyQueue()`，不是手工状态）：全部 / 正常 / **待复核**（权利不明、状态待复核或超 180 天未复核）/ **已失效**（链接失效或过失效时间）/ **已停用**（手动停用优先级最高）；Tab 带计数；
- 新增、编辑（全字段表单 `ResourceFormModal.tsx`，前端校验与闸门必填项一致）、停用（二次确认）、重新启用、标记已复核（刷新复核时间/复核人并恢复正常）；每张卡显示"不强推原因"与使用统计（查看次数、加入计划次数，来自记录数据汇总）；
- **停用后立即不再产生新推荐**（既有待安排记录保留，不静默删除）；
- 权限双重：后台整体 `RequireRole(STAFF_ROLES)`；写操作仅 `resource_reviewer`/`admin`，UI 隐藏写按钮且 service 层 `ensureResourceAdmin()` 二次校验（`exam_reviewer` 只读）。

### 记录数据与存储

- `ResourceViewRecord`（id/userId/resourceId/viewedAt）：每次点击"查看来源"追加，存 `kb_resource_views`；
- `ResourcePlanLink`（id/userId/resourceId/examTargetId/module/status/estimatedMinutes/createdAt/updatedAt）：加入本周计划的待安排任务数据，状态机 `pending_arrangement → arranged → in_use → used`，可 `dismissed`，存 `kb_resource_plan_links`，按账号隔离；
- 公共资源存 `kb_public_resources`（全局，与用户私有资料 `kb_materials` 物理分开；**没有任何代码路径会把用户私有上传自动加入公共资源库**）；
- 用户端/后台写同一份存储，通过 `src/lib/resources/events.ts` 共享事件即时同步。

### 文件结构

```
src/lib/resources/
├── domain.ts           # 纯规则层：权利层级/旧数据归一化/合规闸门/范围匹配/打分排序/队列分类/查找建议
├── resourceService.ts  # 浏览/匹配/查看与加计划记录/后台 CRUD（写操作角色校验）/队列与统计
├── events.ts           # 资源存储共享事件
└── useResources.ts     # useGapMatches / useMyResourceLinks / useBrowseableResources / useAdminResources
src/components/resources/
└── GapResourcePanel.tsx    # 缺口匹配卡（资源卡 + 加入计划 + 空态建议）
src/components/admin/
└── ResourceFormModal.tsx   # 新增/编辑全字段表单
src/app/admin/resources/
└── page.tsx                # 五队列 + 停用/启用/复核 + 只读权限
```

### 四组匹配案例（杭州·初中·2026 主目标，种子共 13 条）

| 缺口 | 预期结果 | 被过滤/特殊资源 |
| ---- | ---- | ---- |
| 课程标准 | 1 条：教育部 2022 课标（官方） | — |
| 真题 | 2 条：浙江省笔试说明（官方，第 1）+ 第三方题型整理（仅索引，第 2） | pr-201 网盘扫描合集：权利不明 + 链接失效 → 进已失效队列，不推荐 |
| 教育学 | 2 条：平台自制精讲（第 1）→ 高校开放课程（开放授权，第 2） | — |
| 心理学 | 0 条："暂无已核验资源" + 查找建议 | 候选分别为：权利不明押题（待复核）、已授权但已停用讲义（已停用，后台启用后才出现）、2023 旧版过期资料（已失效） |

另有教育法规缺口 1 条官方条文；"教学设计开放资料"超 180 天未复核进待复核队列。停用联动：后台启用 pr-301 后学生端心理学缺口立即出现 1 条；停用后恢复空态（已走查验证）。

本次明确**不包含**：资源付费、网盘下载、第三方全文复制、用户私有资料自动入库、真实链接巡检与生产级鉴权。

## 7 天计划与任务生成

将当前目标考试、已审核考情、资料诊断、已加入计划的公共资源和用户可用时间转化为可执行的 7 天计划。计划规则全部在独立的 PlanEngine（`src/lib/plans/domain.ts`，纯函数），没有真实 AI 接口时使用确定性规则生成，同样输入永远得到同样结果。

### 计划输入与就绪检查

生成计划依赖：当前主目标、考情证据、资料诊断快照、已加入计划的公共资源、薄弱模块、每日/每周可用时间。

`checkPlanReadiness` 判定是否可生成：
- **硬性缺失（不生成）**：目标未确认 / 没有任何可用学习内容（无 continue/partial 资料 且 无已加入计划资源）/ 每日可用时间 ≤ 0；
- **软警告（生成但提示）**：考试科目未官方确认 → 默认只排语文学科模块；其他高影响字段未官方确认 → 提示计划可能需调整。

### 生成规则（PlanEngine 唯一口径）

1. 每天最多 3 项任务；
2. 每天任务总时长不超过当天可用时间；
3. 每天至少保留 1 项最低可完成任务；
4. 关键考试模块与薄弱模块优先（薄弱 → 必需 → 补充）；
5. 诊断结论为 pause 的资料/模块不作为任务来源；
6. 目标或关键数据不足时不生成完整计划；
7. 生成结果先为草稿（status=draft），用户确认后进入执行状态（status=active）。

### 任务字段（`PlanTask`）

日期（DailyPlan.date）、学习模块（module）、使用资料或资源（materialId/resourceId + sourceType）、具体章节（chapterTitle）、预计时间（estimatedTime）、完成标准（completionCriteria）、安排原因（arrangementReason）、复盘动作（reviewAction）、优先级（priority：high/medium/low）、当前状态（status）。

### 页面交互（`/plan`）

- 七天概览卡片，点击展开每日任务；
- 查看每项任务的安排原因、完成标准、复盘动作；
- 草稿状态下「确认计划，开始执行」；
- 调整每日可用时间（不自动重排，需重新生成）；
- 「重新生成草稿」基于当前输入产出新版本；
- 查看计划版本历史。

### 今日任务模块联动

确认后的计划（status=active）会被 `/today` 读取，展示当天任务。未确认的草稿不会出现在今日任务。

### 文件结构

```
src/lib/plans/
├── domain.ts          # PlanEngine：就绪检查、来源收集、优先级排序、时间分配（纯函数）
├── planService.ts     # 持久化、生成草稿、确认、重新生成、调整时间、版本历史
└── usePlans.ts        # 响应式订阅（计划/目标/资料/资源/会话变化自动刷新）
src/components/plans/
└── DailyPlanCard.tsx  # 可展开的每日任务卡（含时间调整）
```

### 三种可用时间案例验证

以杭州初中 2026 主目标（1 套适用资料 + 5 个模块）为例：

| 每日可用时间 | 每天任务数 | 说明 |
| ---- | ---- | ---- |
| 60 分钟（低） | 1 项 | 仅最低可完成任务，isMinimumViable=true |
| 120 分钟（中） | 2 项 | 两项核心任务，总时长不超 120 分钟 |
| 180 分钟（高） | 最多 3 项 | 前几天排满 3 项，来源用完后保底复盘任务 |

### 本次不实现

任务反馈驱动的自动重排、第 4 天自适应重排、跨周计划衔接。调整每日时间只更新标记，不重新分配任务。

## 今日任务与执行反馈

让用户在 `/today` 快速看到当天最重要的任务，并在一分钟内提交真实执行结果，为下一模块（计划重排）积累数据。今日页只读取**当前执行中计划**（`status=active`），不涉及任何计划生成规则。

### 今日任务展示

- 当天 1—3 项核心任务 + 补充任务分组；时间不足的日子标记"最低可完成任务"；
- 每项展示：学习模块、资料/资源与具体章节、预计时间、完成标准、安排原因；
- 顶部汇总待反馈数、计划用时/可用时间、已记录实际用时。

### 反馈字段（`TaskFeedback`，独立存储 `kb_task_feedbacks`）

每条反馈**关联用户、计划版本与任务**：`userId` / `weeklyPlanId` + `weeklyVersion` / `dailyPlanId` / `date` / `taskId`。

- 完成状态（`CompletionStatus`）：完成 / 部分完成 / 未完成；
- 实际用时（分钟，默认带出预计时间，±15 快捷调整）；
- 未完成原因（`IncompleteReason`）：时间不够 / 内容太难 / 资料不合适 / 状态不好 / 其他（仅非"完成"时出现）；
- 主要错因（`ErrorCategory`，七项多选）：知识点不会、题目理解错误、答题结构不清、时间不够、粗心、资料或任务不适合、其他；
- 是否完成二次练习；补充说明（选填）。

### 交互规则（`src/lib/plans/feedbackService.ts`）

1. 一分钟表单：除补充说明外全部点选，实际用时默认带出预计时间；
2. **一任务一反馈**：同一任务重复提交时 service 抛 `DuplicateFeedbackError`，UI 只显示"修改反馈"；
3. 已提交反馈可修改：保留 `createdAt`、刷新 `updatedAt`，摘要显示"已修改 · 更新于 …"；
4. 未完成只记录事实：任务状态同步为 completed/partial，未完成不改任务状态，**不删除、不顺延到明天**；
5. 提交后按状态显示简短下一步提示（正式重排由下一模块负责）；
6. 保存失败（严格写入抛错）时表单保留输入并红字提示，可直接重试。

### 状态覆盖

计划未确认 → 引导去 `/plan`；今天不在计划周期/当日无任务 → 空态；正常执行；已提交反馈（只读摘要+修改入口）；保存失败（内联重试）；重复提交（service 拦截+UI 无重复入口）；日期变化（`useTodayString` 监听 30s 定时/visibilitychange/focus，跨午夜自动切天）。

### 为重排模块预留的数据出口

`feedbackService.listByTask / listByDailyPlan / listByWeeklyPlan / listByDate / listMine`，反馈含计划版本号，后续可按版本聚合错因与未完成原因。

### 文件结构

```
src/lib/plans/
├── feedbackService.ts   # 反馈持久化/防重复/修改/任务状态同步（不重排）
└── useToday.ts          # 本地日期与跨午夜自动切天
src/components/plans/
├── TodayTaskItem.tsx    # 单任务+反馈交互状态机（表单开合/保存中/失败重试）
└── FeedbackSummary.tsx  # 已提交反馈只读摘要（含更新时间）
src/components/ui/
└── FeedbackForm.tsx     # 一分钟点选式反馈表单（支持修改模式）
```

### 手动验证步骤

1. `/login` 用 `student@demo.app` 登录 → `/plan` 生成草稿并确认；
2. `/today`：核对核心任务数（≤3）、最低任务标记、模块/章节/完成标准/安排原因；
3. 任务 1 提交"完成"（错因/二次练习）→ 绿色提示、摘要出现、待反馈数 -1；
4. 任务 2 提交"部分完成"（原因+两个错因）→ 摘要徽章与标签正确；
5. 任务 3 提交"未完成"（原因+错因）→ 任务仍在当天，未被移动；
6. 已反馈任务无"提交"入口（防重复），点"修改反馈"后字段保留、保存后显示更新时间；
7. 控制台 `JSON.parse(localStorage.getItem("kb_task_feedbacks"))` 核对关联字段与每任务一条；
8. 模拟写入失败：重写 `Storage.prototype.setItem` 对 `kb_task_feedbacks` 抛错 → 表单红字且不丢输入，恢复后重试成功。

## 目录结构

```
src/
├── app/                    # 页面路由
│   ├── onboarding/         # 目标澄清页
│   ├── exam/               # 我的考试页
│   ├── materials/          # 资料与能力基线页
│   ├── plan/               # 本周计划页
│   ├── today/              # 今天与复盘页
│   ├── settings/           # 设置页
│   ├── login/              # 登录页
│   ├── admin/              # 运营后台（角色保护）
│   │   ├── exams/          # 考情与证据管理
│   │   ├── reviews/        # 考情审核队列与详情
│   │   ├── resources/      # 公共资源管理（五队列/停用/复核）
│   │   ├── layout.tsx      # 后台布局 + 子导航 + RequireRole
│   │   └── page.tsx        # 后台概览
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
│   ├── admin/              # 考情审核后台组件
│   │   ├── ReviewQueue.tsx  # 五队列标签 + 结论卡片
│   │   ├── ReviewDetail.tsx # 详情/动作表单（必填原因）/历史版本
│   │   ├── AdminExamList.tsx# 目标证据状态总览
│   │   └── ResourceFormModal.tsx # 公共资源新增/编辑表单
│   ├── resources/          # 公共资源匹配组件
│   │   └── GapResourcePanel.tsx  # 缺口匹配卡 + 加入计划 + 空态建议
│   ├── materials/          # 资料与能力基线组件
│   │   ├── InventoryStatusPicker.tsx # 资料状态三入口
│   │   ├── MaterialForm.tsx          # 资料新增/编辑弹窗
│   │   ├── MaterialListItem.tsx      # 资料卡 + 逐项诊断
│   │   ├── AbilityBaselineForm.tsx   # 能力基线表单
│   │   ├── DiagnosisPanel.tsx        # 诊断结果面板
│   │   └── PublicResourceList.tsx    # 公共资源只读列表
│   ├── plans/              # 7 天计划与今日反馈组件
│   │   ├── DailyPlanCard.tsx        # 可展开每日任务卡 + 时间调整
│   │   ├── TodayTaskItem.tsx        # 今日任务+反馈交互（提交/失败重试/修改）
│   │   └── FeedbackSummary.tsx      # 已提交反馈只读摘要（含更新时间）
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
│   │   ├── events.ts       # 证据存储共享事件（用户端/审核后台写入互相同步）
│   │   ├── evidenceService.ts
│   │   └── useEvidence.ts
│   ├── admin/              # 考情审核后台（本地 Mock，非生产）
│   │   ├── domain.ts       # 权限/队列分类/风险与临期判定（纯函数）
│   │   ├── adminReviewService.ts # 鉴权/队列/详情/版本/留痕事务
│   │   └── useAdminReviews.ts
│   ├── materials/          # 资料与能力基线（本地 Mock，非生产）
│   │   ├── domain.ts       # 模块目录/考情就绪/范围匹配/诊断/冲突/签名（纯函数，唯一规则层）
│   │   ├── materialService.ts # 私有资料 CRUD/基线/诊断快照与播种
│   │   └── useMaterials.ts
│   ├── resources/          # 公共资源索引与缺口匹配（本地 Mock，非生产）
│   │   ├── domain.ts       # 权利层级/合规闸门/范围匹配/打分排序/队列分类（纯函数，唯一规则层）
│   │   ├── resourceService.ts # 浏览/匹配/查看与加计划记录/后台 CRUD 与角色校验
│   │   ├── events.ts       # 资源存储共享事件
│   │   └── useResources.ts
│   ├── plans/              # 7 天计划与任务生成（本地 Mock，非生产）
│   │   ├── domain.ts       # PlanEngine：就绪检查/来源收集/优先级/时间分配（纯函数，唯一规则层）
│   │   ├── planService.ts  # 草稿/确认/重新生成/调整时间/版本历史
│   │   ├── feedbackService.ts # 执行反馈：防重复提交/修改留痕/任务状态同步（不重排）
│   │   ├── usePlans.ts
│   │   └── useToday.ts     # 本地日期与跨午夜自动切天
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
- 考情证据种子（`mockEvidenceItems`：3 条官方确认 + 1 条历史经验 + 5 条审核演示用待审核/AI提取结论，含来源冲突对与临期报名时间）与示例公告文本（`SAMPLE_ANNOUNCEMENT_TEXT`）
- 用户私有资料（`mockMaterials`，按账号+目标隔离）与能力基线（`mockAbilityBaselines`），含三组案例：无资料（温州演示目标）、一套适用（杭州当前目标）、多套冲突（宁波演示目标）；首次进入 `/materials` 时由规则层播种初始诊断快照
- 公共资源（`mockResources`：13 条 `ResourceItem` 种子，覆盖官方/自制/开放/授权/第三方/权利不明、坏链、停用、过期、超期未复核等案例，存独立的 `kb_public_resources`；查看与加计划记录分别存 `kb_resource_views`、`kb_resource_plan_links`）
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
- **公告提取与考情证据**: 已有完整的提交→异步提取（进度/失败/重试/待审核）→字段画像→纠错演示链路，但**没有真实 AI/后端**：链接来源不抓取网页（按目标模拟并明确标注“模拟提取”），文本来源为浏览器本地正则/关键词规则识别，文件上传仅占位。替换点 `evidenceService.setExtractor()`，详见上方“公告提交与考情证据”章节
- **考情审核后台**: 已有五队列/详情对照/五动作/必填原因/留痕与版本/字段级权限的完整交互，但**没有真实后端**：权限与留痕均为前端 + localStorage 实现，非生产级安全审计；详见上方“考情审核后台”章节
- **资料诊断**: `/materials` 已实现本地确定性规则诊断（规则层 `src/lib/materials/domain.ts`）：资料状态三入口、私有资料 CRUD、能力基线、逐模块继续/部分/暂缓结论、冲突取舍、缺口与最小资料类别、签名过时提示；但**不是 AI、不联网**，内置资料为虚构 Mock，不含购买与 PDF 解析；缺口公共资源匹配见“公共资源索引与资料缺口匹配”章节
- **计划自动生成**: 7天计划为固定Mock数据；且**仅在目标满足门禁后展示**，未澄清时显示“请先完成目标澄清”
- **智能重排**: 第4天重排和第7天复盘为静态展示
- **资源匹配**: 缺口资源匹配基于确定性规则（五层流水线：模块→合规闸门→适用范围→权利层级排序→最多 3 条），非 AI 计算，不做商业排行；链接有效性与权利状态为演示种子，无真实巡检
- **登录鉴权**: 已有登录/会话/角色与路由保护，但是 **Demo 模拟实现**（本地校验 + localStorage），不是真实安全认证
- **管理后台**: 考情审核与公共资源索引已上线（本地 Mock）；纠错与治理等模块仍为占位

## 模块变更记录

| 日期 | 模块 | 变更 |
| ---- | ---- | ---- |
| 2026-10-01 | 前端骨架 | 初始化 Next.js 16 App Router + React 19 + TS + Tailwind 4 骨架与静态页面 |
| 2026-10-01 | 账号、会话与基础资料 | Demo 认证（登录/会话恢复/角色/路由保护）、设置页资料修改、AuthService 三层分离 |
| 2026-10-02 | 目标澄清与目标考试 | 新增四种目标状态入口与 `ExamTarget`/`TargetStatus`/`ClarificationTask` 类型；新增 `src/lib/targets/domain.ts` 门禁与澄清任务领域逻辑；`examTargetService` 支持多目标创建/编辑/切换/归档/重新启用与订阅式刷新；`/onboarding`、`/exam` 重写，`/plan`、`/today` 增加目标门禁，侧边栏/顶栏展示当前主目标摘要；数据本地 Mock + localStorage 按账号隔离。不含公告解析、人工审核、计划生成 |
| 2026-10-02 | 公告提交与考情证据 | 新增 `EvidenceType`（11 字段）/`ReviewStatus`（6 状态）/`EvidenceItem`/`ExtractionJob`/`ExtractionJobStatus` 类型与 `src/lib/evidence/`（domain 纯函数、可替换 `EvidenceExtractor` + Mock 提取、evidenceService、useEvidence）及 `src/components/evidence/` 三个组件；`/exam` 改造为考情画像/提交公告/待确认与纠错三标签；三入口（链接模拟/文本本地规则/文件占位）、五状态任务（进度/失败原因/重试/刷新中断判定）、高影响字段强制待审核、AI 结论永不自动官方确认、来源冲突对照、纠错持久化、证据按目标+账号隔离；official 仅种子数据。不含真实 AI/抓取/文件解析/人工审核/资格判断/上岸概率 |
| 2026-10-03 | 资料与能力基线 | 新增 `UsageStatus`/`MaterialSourceType`/`MaterialItem`/`AbilityBaseline`/`MaterialDiagnosis(Snapshot)`/`MaterialConflictGroup` 等类型与标签常量；新增 `src/lib/materials/`（domain 纯规则层：15 个考试模块、章节关键词预填、考情就绪与必需模块、地区/学段/年份匹配、逐模块诊断、多套确定性取舍、8 小时时间约束、薄弱项并集、djb2 签名；materialService：私有资料 CRUD/基线/快照播种与 recompute；useMaterials 订阅 hook）与 `src/components/materials/` 六个组件；`/materials` 重写为四个标签（我的资料/能力基线/诊断结果/公共资源），考情未确认横幅、过时重算提示、无资料最小类别清单；resourceService 存储键修正为独立 `kb_public_resources`；mock-data 新增 2 个演示目标与三组案例资料/基线及 `kb_ability_baselines`/`kb_material_diagnoses` 键；导航更名"资料与基线"。不含购买、PDF 解析、排行与公共资源匹配 |
| 2026-09-30 | 考情审核后台 | 新增 `ReviewLog`/`ReviewActionType`/`ReviewQueueKey` 类型与队列/动作/原因预置文案，`EvidenceItem` 增加 `reviewerFlaggedConflict`；新增 `src/lib/evidence/events.ts` 共享事件（用户端与审核后台写同一份证据存储并互相同步）；新增 `src/lib/admin/`（domain 纯函数：字段级权限/五队列分类/高风险排序/45 天临期判定；adminReviewService：队列、详情、目标分组、留痕查询、submitReview 双重鉴权+必填原因+已发布修改才升版本+不可变留痕；useAdminReviews hooks）与 `src/components/admin/` 三个组件；新增 `/admin/exams`、`/admin/reviews` 页面与后台子导航，后台概览改为真实入口；画像冲突口径修正（驳回/待确认不参与主结论，历史/个人仅备选，支持手动冲突标记）；mock-data 增加 5 条审核演示种子与 `kb_review_logs` 键。本地 Mock 非生产；不含真实后端鉴权、大范围撤回与纠错处理流 |
| 2026-10-01 | 公共资源索引与资料缺口匹配 | 新增 `ResourceItem`/`RightsStatus`/`ResourceStatus`/`ResourceMatch`/`ResourcePlanLink`/`ResourceViewRecord`/`ResourceQueueKey` 类型与标签（旧 `PublicResource` 保留为别名）；新增 `src/lib/resources/`（domain 纯规则层：权利层级、合规闸门、范围匹配、打分排序、180 天复核周期、队列分类、旧数据归一化；resourceService：浏览/匹配/查看与加入计划记录/后台 CRUD 双重角色校验/队列统计；events；useResources hooks）与 `src/components/resources/GapResourcePanel.tsx`；诊断结果页按缺口展示最多 3 个资源（理由/范围/权利/查看来源/加入本周计划/空态查找建议），公共资源浏览列表改走同一闸门；新增 `/admin/resources`（五队列计数、新增/编辑/停用/启用/标记复核、不强推原因与使用统计，resource_reviewer/admin 可写、exam_reviewer 只读）与 `ResourceFormModal`，后台导航与概览卡上线；mock 资源重写为 13 条 `mockResources`（四组匹配案例 + 坏链/停用/权利不明/过期/超期未复核），新增 `kb_resource_views`、`kb_resource_plan_links` 存储键；私有资料与公共资源物理隔离、无私有上传自动入库路径。不含付费、网盘下载、第三方全文复制 |
| 2026-10-01 | 7 天计划与任务生成 | 新增 `PlanStatus`/`TaskPriority`/`TaskSourceType` 类型，`WeeklyPlan` 增加 `generationReason`，`DailyPlan` 增加 `availableMinutes`，`PlanTask` 增加 `sourceType`/`chapterTitle`/`resourceId`/`arrangementReason`/`reviewAction`/`priority`；新增 `src/lib/plans/`（domain 纯函数 PlanEngine：就绪检查、任务来源收集、优先级排序、每天≤3 项/总时长≤可用时间/每天≥1 项最低任务的时间分配；planService：草稿生成/确认执行/重新生成/调整每日时间/版本历史；usePlans 订阅 hook）与 `src/components/plans/DailyPlanCard.tsx`；`/plan` 重写为缺失信息提示→生成草稿→七天概览→展开任务（含安排原因/完成标准/复盘动作/优先级）→确认→版本历史→调整时间；`/today` 改为读取已确认计划（status=active）的当日任务；移除旧版 `mockWeeklyPlan`/`mockDailyPlans`，新增 `kb_daily_plans` 存储键。不含任务反馈驱动的自动重排、第 4 天自适应重排、跨周计划衔接 |
| 2026-10-01 | 今日任务与执行反馈 | 新增 `CompletionStatus`/`ErrorCategory`（旧 `ErrorType` 保留别名）/`IncompleteReason`/`TaskFeedbackInput` 类型与完成状态/未完成原因/错因中文标签（错因七项：知识点不会/题目理解错误/答题结构不清/时间不够/粗心/资料或任务不适合/其他）；`TaskFeedback` 扩展为关联用户+计划版本（weeklyPlanId/weeklyVersion）+日计划+日期+任务，新增 `updatedAt`；新增 `src/lib/plans/feedbackService.ts`（独立 `kb_task_feedbacks` 存储、一任务一反馈重复提交抛 `DuplicateFeedbackError`、修改保留 createdAt 刷 updatedAt、同步任务状态但不删除不顺延、listByTask/DailyPlan/WeeklyPlan/Date 查询出口）与 `useToday.ts`（跨午夜 30s/visibility/focus 自动切天）；重写 `FeedbackForm` 为一分钟点选式表单（完成三态/±15 用时/条件原因/错因多选/二次练习/选填说明/修改模式/保存失败内联重试）；新增 `TodayTaskItem`/`FeedbackSummary` 组件，`/today` 重写为只读 active 计划、核心+补充分组、最低任务标记、待反馈计数、提交后状态化下一步提示；planService 移除旧 submitTaskFeedback，归一化兼容旧版内嵌反馈。不含自动重排与任务顺延 |

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
