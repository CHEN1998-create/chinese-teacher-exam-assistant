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
| `/onboarding` | 目标澄清 | 选择目标状态、填写基础信息、上传公告（需登录） |
| `/exam` | 我的考试 | 查看考试画像、证据卡、待确认信息、提交纠错（需登录） |
| `/materials` | 资料与资源 | 管理备考资料、查看诊断结果、发现缺少模块（需登录） |
| `/plan` | 本周计划 | 查看7天计划、每日任务、调整说明（需登录） |
| `/today` | 今天与复盘 | 查看今日任务、提交执行反馈（需登录） |
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
│   │   ├── EvidenceCardItem.tsx
│   │   ├── MaterialCard.tsx
│   │   ├── ResourceCard.tsx
│   │   ├── TaskCard.tsx
│   │   └── FeedbackForm.tsx
│   └── layout/             # 布局组件
│       ├── AppShell.tsx
│       ├── Sidebar.tsx
│       ├── BottomNav.tsx
│       └── Header.tsx
├── lib/
│   ├── auth/               # 认证模块（Demo 实现，见上方说明）
│   ├── mock-data.ts        # Mock数据
│   ├── services.ts         # 数据服务层（当前用户从会话读取）
│   ├── storage.ts          # 本地存储工具
│   └── utils.ts            # 工具函数
└── types/
    └── index.ts            # TypeScript类型定义
```

## Mock数据位置

所有 Mock 数据集中在 `src/lib/mock-data.ts`，包括：

- 用户信息
- 目标考试
- 考情证据卡
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

- **AI公告解析**: 上传公告后不会真实解析
- **AI资料诊断**: 诊断结果基于预置Mock数据
- **计划自动生成**: 7天计划为固定Mock数据
- **智能重排**: 第4天重排和第7天复盘为静态展示
- **资源匹配**: 推荐资源基于固定规则，非AI计算
- **登录鉴权**: 已有登录/会话/角色与路由保护，但是 **Demo 模拟实现**（本地校验 + localStorage），不是真实安全认证
- **管理后台**: 仅有角色保护下的占位框架，审核业务逻辑未实现

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
