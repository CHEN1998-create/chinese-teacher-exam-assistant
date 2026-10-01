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
| `/onboarding` | 目标澄清 | 选择目标状态、填写基础信息、上传公告 |
| `/exam` | 我的考试 | 查看考试画像、证据卡、待确认信息、提交纠错 |
| `/materials` | 资料与资源 | 管理备考资料、查看诊断结果、发现缺少模块 |
| `/plan` | 本周计划 | 查看7天计划、每日任务、调整说明 |
| `/today` | 今天与复盘 | 查看今日任务、提交执行反馈 |
| `/settings` | 设置与数据 | 修改个人信息、通知设置、隐私管理 |

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
│   ├── layout.tsx          # 全局布局
│   └── page.tsx            # 首页（重定向）
├── components/
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
│   ├── mock-data.ts        # Mock数据
│   ├── services.ts         # 数据服务层
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
- **登录鉴权**: 无真实登录系统
- **管理后台**: 本次未实现运营后台页面

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
