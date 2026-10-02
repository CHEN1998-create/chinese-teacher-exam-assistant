# 公开演示环境部署说明

> 本项目当前部署形态为**公开演示环境（APP_ENV=demo）**，不是正式生产环境。
> 所有数据仅保存在访客本机浏览器（localStorage），没有真实后端、数据库、认证、文件存储和 AI 服务。

## 1. 部署环境说明

| 项目 | 说明 |
|---|---|
| 环境标识 | `NEXT_PUBLIC_APP_ENV=demo`、`NEXT_PUBLIC_DEMO_MODE=true` |
| 数据去向 | 仅写入访客浏览器 localStorage，不上传任何服务器 |
| 管理后台 | `/admin` 全部子路由在演示环境关闭，显示关闭说明 |
| 搜索可见性 | `noindex,nofollow`（meta + `X-Robots-Tag` 双保险） |
| 传输加密 | 平台自动提供 HTTPS |

## 2. 当前技术栈

- Next.js 16.3.8（App Router，Turbopack 构建）
- React 19.2.8
- TypeScript 5（strict）
- Tailwind CSS 4
- 无服务端运行时依赖：全部页面为客户端组件，构建产物全部为静态预渲染

## 3. 本地启动

```bash
npm install
npm run dev
```

打开 http://localhost:3000。

## 4. 生产构建

```bash
# 以演示环境变量构建
$env:NEXT_PUBLIC_APP_ENV="demo"        # PowerShell
$env:NEXT_PUBLIC_DEMO_MODE="true"
npm run build

# 本地预览生产产物
npm run start
```

macOS / Linux：

```bash
NEXT_PUBLIC_APP_ENV=demo NEXT_PUBLIC_DEMO_MODE=true npm run build
npm run start
```

## 5. 部署平台：Vercel

选择 Vercel 的原因：Next.js 由 Vercel 维护，对 Next.js 16 兼容性最好；Hobby 免费计划满足演示需求，自动 HTTPS、每次推送自动生成预览部署。

### 首次部署（CLI）

```bash
npx vercel login            # 邮箱接收确认链接
npx vercel link             # 关联/创建项目（仅首次）
npx vercel env add NEXT_PUBLIC_APP_ENV production   # 输入 demo
npx vercel env add NEXT_PUBLIC_DEMO_MODE production # 输入 true
npx vercel --prod
```

### 重新部署

```bash
npx vercel --prod
```

### 通过 Git 自动部署

在 Vercel 导入 GitHub 仓库后，推送到主分支自动触发生产部署；其余分支/PR 自动生成预览部署。

## 6. 环境变量

| 变量名 | 取值 | 范围 | 用途 |
|---|---|---|---|
| `NEXT_PUBLIC_APP_ENV` | `demo` / `production` | 浏览器（会被内联） | 运行环境标识 |
| `NEXT_PUBLIC_DEMO_MODE` | `true` / 未设置 | 浏览器（会被内联） | 演示模式总开关 |

仅允许 `NEXT_PUBLIC_*` 变量；变量样例见 `.env.example`。真实环境变量在 Vercel 项目设置中配置，不提交仓库。

## 7. 演示模式行为

- 所有页面顶部固定显示黄色横幅，提醒"数据仅用于功能展示，请勿填写真实个人信息；输入仅保存在本机浏览器"。
- 登录页明确声明：内置演示账号、不是真实身份认证、演示数据不代表正式服务数据。
- 种子考情的状态标签显示为"官方确认**·演示**"，来源带"示例来源"标记。
- `/settings` 提供"重置演示数据"：清空本浏览器全部数据并恢复默认种子。

## 8. Mock / 占位能力清单

| 能力 | 当前实现 | 用户可见提示 |
|---|---|---|
| 登录认证 | 本地明文比对内置演示账号，会话存 localStorage | 登录页声明 + 横幅 |
| 公告 URL 提取 | 不访问网页，按目标信息生成模拟结果 | 字段摘录标注"模拟提取" |
| 公告文本提取 | 浏览器本地规则识别（无 AI、无网络） | 页面说明 |
| 文件上传 | 占位入口：仅记录文件名，不读取/保存/上传 | 上传区警告文案，提交禁用 |
| 资料诊断 / 计划生成 / 重排 | 本地确定性规则引擎 | 演示数据标记 |
| 通知（短信/邮件/推送） | 本地模拟，不发送任何真实消息 | 通知面板标注 |
| 数据删除 | 只清理浏览器本地数据 | 隐私面板明确说明 |

## 9. 管理端限制

公开演示环境中 `/admin` 及其全部子路由（exams / reviews / feedback / resources）统一显示"管理后台未在公开演示环境开放"，不渲染任何管理功能，任何写操作（审核、驳回、停用、撤回）均无法触发。

> **正式管理后台上线前提**：服务端认证（成熟认证方案）+ 服务端/数据库行级权限校验 + 操作审计，客户端隐藏按钮不构成安全边界。

## 10. 回滚

- Vercel Dashboard → Deployments → 选择历史部署 → Promote to Production（即时回滚，无需重新构建）。
- CLI：`npx vercel ls` 查看部署，`npx vercel promote <deployment-url>` 切换。
- 演示数据仅存在访客浏览器，无服务端数据需要回滚。

## 11. 后续接入真实前后端需要修改的位置

按依赖顺序：

1. **真实认证**：新建 `src/lib/auth/HttpAuthProvider.ts`（实现现有 `AuthService` 接口），替换 `src/lib/auth/instance.ts` 中的单例；接入成熟认证服务。
2. **数据库**：建立 PostgreSQL Schema 与迁移，页面经服务端 API 读写，移除 localStorage 存储。
3. **公告上传与存储**：接入私有对象存储，替换 `AnnouncementSubmitForm` 文件占位；上传走服务端签名，校验类型与大小。
4. **公告字段提取**：实现服务端提取 API（AI 调用在服务端完成），替换 `src/lib/evidence/extractor.ts` Mock。
5. **考情审核**：服务端审核接口与权限，重新启用 `/admin` 布局与审核队列。
6. **资料诊断 / 资源匹配 / 计划生成 / 执行反馈 / 动态重排**：逐个以服务端 API 替换本地规则引擎与存储（各 `src/lib/*/` 服务已按接口隔离）。
7. **通知 / 数据删除 / 指标监控**：接入真实推送、服务端删除流程与服务端日志监控。

每步替换时移除页面中的直接 Mock 引用，并验证加载/成功/空态/失败/权限不足；生产环境不得静默回退到 Mock。
