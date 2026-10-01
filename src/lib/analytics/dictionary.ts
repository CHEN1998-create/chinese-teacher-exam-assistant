/**
 * 事件字典与指标字典：统一口径的唯一登记处。
 *
 * - 新增埋点必须先在 EVENT_DICTIONARY 登记；
 * - 指标的名称、口径、数据来源、是否随时间范围变化以 METRIC_DICTIONARY 为准，
 *   UI 与 README 均从这里取说明，避免不同组件各自解释。
 */
import { AnalyticsEventType } from "./types";

export interface EventDictionaryEntry {
  type: AnalyticsEventType;
  label: string;
  /** 触发时机（在哪个动作/模块写入） */
  trigger: string;
  /** 记录的维度（不含用户正文） */
  properties: string;
  /** 是否需求规定的 13 类用户价值事件 */
  core: boolean;
}

export const EVENT_DICTIONARY: EventDictionaryEntry[] = [
  {
    type: "target_created",
    label: "创建目标考试",
    trigger: "目标澄清页/我的考试页保存目标成功后（examTargetService.persistNew）",
    properties: "目标ID、是否达到计划门禁 ready、目标状态；无地区正文",
    core: true,
  },
  {
    type: "evidence_viewed",
    label: "查看证据卡",
    trigger: "用户在我的考试页打开“考情画像”标签（同一会话每目标只记一次）",
    properties: "目标ID",
    core: true,
  },
  {
    type: "source_opened",
    label: "打开原始来源",
    trigger: "在证据卡点击“打开原始来源”链接",
    properties: "目标ID、字段枚举；不记录链接 URL",
    core: true,
  },
  {
    type: "material_added",
    label: "新增私有资料",
    trigger: "资料页新增资料成功（materialService.create）",
    properties: "目标ID、资料来源类型枚举",
    core: true,
  },
  {
    type: "diagnosis_viewed",
    label: "查看资料诊断",
    trigger: "资料页打开“诊断与缺口”标签（同一会话每目标只记一次）",
    properties: "目标ID",
    core: true,
  },
  {
    type: "resource_viewed",
    label: "查看公共资源",
    trigger: "点击资源“查看来源”（resourceService.recordView，不去重）",
    properties: "资源ID",
    core: true,
  },
  {
    type: "resource_added_to_plan",
    label: "资源加入计划",
    trigger: "缺口资源点击“加入本周计划”成功（resourceService.addToPlan）",
    properties: "目标ID、资源ID、缺口模块枚举",
    core: true,
  },
  {
    type: "plan_confirmed",
    label: "确认周计划",
    trigger: "草稿计划被确认执行（planService.confirmPlan；kind=initial 首版 / replan 重排版）",
    properties: "目标ID、计划ID、开始日期、版本、首版/重排",
    core: true,
  },
  {
    type: "task_feedback_submitted",
    label: "提交任务反馈",
    trigger: "今天页提交执行反馈成功（feedbackService.submit，修改不计新事件）",
    properties: "目标/计划ID、日期、第几天、完成状态枚举、是否核心任务；不记录备注",
    core: true,
  },
  {
    type: "plan_replanned",
    label: "确认重排计划",
    trigger: "重排草稿被确认（confirmPlan 中版本 v2+ 或重排面板确认）",
    properties: "目标ID、计划ID、前后版本号",
    core: true,
  },
  {
    type: "weekly_review_completed",
    label: "完成周复盘",
    trigger: "第 7 天/计划完结后生成周复盘（replanService.generateReview）",
    properties: "目标ID、计划ID",
    core: true,
  },
  {
    type: "correction_submitted",
    label: "提交纠错",
    trigger: "用户提交纠错成功（correctionService.submit）",
    properties: "目标ID、纠错对象类型枚举；不记录描述与建议正文",
    core: true,
  },
  {
    type: "data_delete_requested",
    label: "申请删除个人数据",
    trigger: "设置/治理页发起删除申请（privacyService.initiateDeletion）",
    properties: "目标ID、申请范围类别总数",
    core: true,
  },
  {
    type: "resource_used",
    label: "资源实际使用（扩展）",
    trigger: "加入计划的资源状态变为使用中/已使用（updateLinkStatus）",
    properties: "目标ID、资源ID、新阶段枚举",
    core: false,
  },
  {
    type: "review_completed",
    label: "人工审核完成（扩展）",
    trigger: "后台提交审核动作成功（adminReviewService.submitReview）",
    properties: "动作枚举、处理时长分钟、是否高影响、是否修正、证据归属用户ID",
    core: false,
  },
  {
    type: "extraction_failed",
    label: "AI提取失败（扩展）",
    trigger: "公告提取任务结束为失败（evidenceService.startExtraction catch）",
    properties: "目标ID、任务ID、错误码",
    core: false,
  },
  {
    type: "plan_generation_failed",
    label: "计划生成失败（扩展）",
    trigger: "门禁通过后的计划生成/持久化失败（“数据不足”的正常拦截不计）",
    properties: "目标ID、错误码",
    core: false,
  },
  {
    type: "feedback_submit_failed",
    label: "反馈保存失败（扩展）",
    trigger: "反馈写入存储失败（feedbackService.submit 持久化异常）",
    properties: "目标ID、错误码",
    core: false,
  },
  {
    type: "critical_write_failed",
    label: "关键写入失败（扩展）",
    trigger: "目标/资料/纠错/删除申请等关键写入持久化失败",
    properties: "模块枚举、存储键名、错误码；不含报错原文",
    core: false,
  },
];

export type MetricCategory = "user_value" | "quality_ops" | "stock";

export interface MetricDictionaryEntry {
  key: string;
  label: string;
  category: MetricCategory;
  /** 统一口径 */
  formula: string;
  /** 数据来源说明 */
  dataSource: string;
  /** 是否随时间范围筛选变化（存量类指标恒为 false） */
  timeFiltered: boolean;
}

export const METRIC_DICTIONARY: MetricDictionaryEntry[] = [
  {
    key: "first_fill_rate",
    label: "首次填写完成率",
    category: "user_value",
    formula: "时间范围内创建目标且达到计划门禁的去重用户数 ÷ 创建目标的去重用户数",
    dataSource: "target_created 事件（live 真实操作 / seed 演示种子）",
    timeFiltered: true,
  },
  {
    key: "evidence_view_rate",
    label: "证据卡查看率",
    category: "user_value",
    formula: "时间范围内查看过证据卡的去重用户数 ÷ 创建目标的去重用户数（同队列）",
    dataSource: "evidence_viewed / target_created 事件",
    timeFiltered: true,
  },
  {
    key: "plan_confirm_rate",
    label: "计划确认率",
    category: "user_value",
    formula: "时间范围内确认首版计划（kind=initial）的去重用户数 ÷ 创建目标的去重用户数",
    dataSource: "plan_confirmed / target_created 事件",
    timeFiltered: true,
  },
  {
    key: "feedback_day_rates",
    label: "第1/4/7天反馈完成率",
    category: "user_value",
    formula:
      "分母=已到达第 N 天的首版计划数（开始日期+N-1 ≤ 今天）；分子=第 N 天存在任意任务反馈的计划数",
    dataSource: "plan_confirmed 与 task_feedback_submitted 事件（planId/startDate/dayIndex）",
    timeFiltered: true,
  },
  {
    key: "core_completed_days",
    label: "7天内完成核心任务的平均天数",
    category: "user_value",
    formula:
      "对时间范围内确认、且有反馈的首版计划，统计核心任务（isCore=1）反馈为“完成”的不同日期数，再求平均",
    dataSource: "task_feedback_submitted 事件",
    timeFiltered: true,
  },
  {
    key: "restart_rate",
    label: "中断后重新开始率",
    category: "user_value",
    formula:
      "出现过“未完成”反馈、且其后又出现“完成/部分完成”反馈的去重用户数 ÷ 出现过“未完成”反馈的去重用户数",
    dataSource: "task_feedback_submitted 事件",
    timeFiltered: true,
  },
  {
    key: "resource_conversion",
    label: "资源查看→加入→使用转化",
    category: "user_value",
    formula:
      "三级去重用户数：查看资源 / 加入本周计划 / 实际使用（使用中或已使用）；逐级计算转化率",
    dataSource: "resource_viewed / resource_added_to_plan / resource_used 事件",
    timeFiltered: true,
  },
  {
    key: "closed_loop_users",
    label: "完整闭环用户数",
    category: "user_value",
    formula:
      "同一时间范围内同时具备 确认首版计划 + 提交任务反馈 + 完成周复盘 的去重用户数",
    dataSource: "plan_confirmed / task_feedback_submitted / weekly_review_completed 事件",
    timeFiltered: true,
  },
  {
    key: "pending_high_impact",
    label: "高影响事实待审核数量",
    category: "stock",
    formula: "全部证据中 reviewStatus=pending_review 且属于 5 个高影响字段的条目数（实时存量）",
    dataSource: "kb_evidence_items 业务数据（本地 Mock）",
    timeFiltered: false,
  },
  {
    key: "review_avg_minutes",
    label: "审核平均处理时间",
    category: "quality_ops",
    formula: "时间范围内 review_completed 事件 durationMinutes 的算术平均（提交/上次更新→审核完成）",
    dataSource: "review_completed 事件",
    timeFiltered: true,
  },
  {
    key: "ai_edit_rate",
    label: "AI提取人工修正率",
    category: "quality_ops",
    formula: "approve_with_edit 次数 ÷（通过 + 修改后通过 + 驳回）次数",
    dataSource: "review_completed 事件 action 维度",
    timeFiltered: true,
  },
  {
    key: "correction_count",
    label: "用户纠错数量",
    category: "quality_ops",
    formula: "时间范围内 correction_submitted 事件数（另展示待处理存量）",
    dataSource: "correction_submitted 事件 + kb_corrections 存量",
    timeFiltered: true,
  },
  {
    key: "retraction_count",
    label: "错误结论撤回数量",
    category: "quality_ops",
    formula: "时间范围内创建的撤回留痕条数",
    dataSource: "kb_retraction_logs 业务数据",
    timeFiltered: true,
  },
  {
    key: "affected_users",
    label: "受影响用户数量",
    category: "quality_ops",
    formula: "时间范围内撤回记录 impact.userIds 的去重并集",
    dataSource: "kb_retraction_logs 业务数据",
    timeFiltered: true,
  },
  {
    key: "resource_dead_rate",
    label: "资源链接失效率",
    category: "stock",
    formula:
      "（链接不可访问 + 已过失效时间）资源数 ÷ 除“已停用”外的资源总数；超 180 天未复核单列预警",
    dataSource: "kb_public_resources 业务数据（实时存量）",
    timeFiltered: false,
  },
  {
    key: "plan_fail_rate",
    label: "计划生成失败率",
    category: "quality_ops",
    formula: "plan_generation_failed 事件数 ÷（首版计划确认数 + 计划生成失败数）",
    dataSource: "plan_generation_failed / plan_confirmed 事件",
    timeFiltered: true,
  },
  {
    key: "feedback_fail_rate",
    label: "反馈提交失败率",
    category: "quality_ops",
    formula: "feedback_submit_failed 事件数 ÷（反馈成功数 + 反馈失败数）",
    dataSource: "feedback_submit_failed / task_feedback_submitted 事件",
    timeFiltered: true,
  },
  {
    key: "review_minutes_per_user",
    label: "单个用户人工审核时间",
    category: "quality_ops",
    formula: "时间范围内审核总时长 ÷ 被审核证据的去重归属用户数",
    dataSource: "review_completed 事件 durationMinutes / ownerId",
    timeFiltered: true,
  },
  {
    key: "critical_write_failures",
    label: "关键数据写入失败数量",
    category: "quality_ops",
    formula: "时间范围内 critical_write_failed 事件数",
    dataSource: "critical_write_failed 事件",
    timeFiltered: true,
  },
];
