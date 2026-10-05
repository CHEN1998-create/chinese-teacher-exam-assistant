/**
 * v6.1 首次体验（访客）画像会话（PRD 7.3）。
 *
 * 未登录用户可以分步完成五组基础画像并查看初步机会结果；
 * 草稿与进度保存在本机浏览器 localStorage（kb_guest_profile_v61），7 天过期。
 *
 * 五组基础画像：
 * 1. 可接受地区（必须接受 / 优先 / 可以考虑）
 * 2. 最高学历和学位
 * 3. 毕业证专业全称
 * 4. 毕业时间和当前就业状态
 * 5. 教师资格状态/学科/学段 + 对用工形式的接受程度
 *
 * 年龄、户籍、社保、工作经历不在这里一次收齐：它们属于条件画像，
 * 只在具体机会需要时按需补问；草稿不包含这些字段，匹配时只能得到 UNKNOWN，
 * 永远不会被自动判定为“不符合”（规则见 lib/matching/domain.ts）。
 *
 * 注意：这不是真实认证或跨设备保存。接入真实后端时，登录成功后再把
 * 完整草稿提交服务端持久化；本轮（模块 4）不做登录持久化。
 */
import {
  IN_SCOPE_EMPLOYMENT_NATURES,
  type CredentialLevel,
  type DegreeCode,
  type EmploymentNatureCode,
  type StageCode,
  type SubjectCode,
} from "@/lib/announcements/types";
import type {
  EmploymentStatus,
  RegionPreference,
  RegionPreferenceLevel,
  TeacherCertInfo,
  TeacherCertStatus,
  UserRecruitmentProfile,
} from "@/lib/profile/types";
import { STORAGE_KEYS } from "@/lib/mock-data";
import { loadFromStorage, saveToStorage, removeFromStorage } from "@/lib/storage";

/** 五组基础画像，分步采集；每组在完成前都允许部分填写 */
export const TOTAL_PROFILE_STEPS = 5;

/** 当前唯一开放学科；其他学科在访客流程中明确分流，不生成匹配结果 */
export const OPEN_SUBJECT = "chinese" as const;

export interface GuestProfileDraft {
  /** 1. 可接受就业地区（至少 1 条才能进入下一组） */
  regions: RegionPreference[];
  /** 2. 最高学历 */
  educationLevel?: CredentialLevel;
  /** 2. 最高学位（无学位显式填 none） */
  degree?: DegreeCode;
  /** 3. 毕业证上的专业全称 */
  majorFullName?: string;
  /** 4. 毕业（或预计毕业）时间，ISO 日期（YYYY-MM-DD） */
  graduationDate?: string;
  /** 4. 当前就业状态 */
  employmentStatus?: EmploymentStatus;
  /** 5. 教师资格情况 */
  teacherCert?: TeacherCertInfo;
  /** 5. 对事业编及其他官方用工形式的接受程度（至少 1 项） */
  acceptedEmploymentNatures: EmploymentNatureCode[];
  /** 5. 意向报考学科；语文以外的学科记为“尚未开放”，不进入匹配 */
  intendedSubject?: SubjectCode;
  /** 非语文用户已在本机留下开注意向（仅本地标记，不发送任何通知） */
  intentionLeft?: boolean;
}

export interface GuestProfileSession {
  draft: GuestProfileDraft;
  /** 已完成到第几组：0 未开始；1..5 为已完成组数；5 表示五组答完可看结果 */
  step: number;
  createdAt: string;
  updatedAt: string;
  /** 过期时间（ISO）：超过后视为无效，重新开始 */
  expiresAt: string;
}

/** 访客数据保留 7 天 */
const GUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function emptyDraft(): GuestProfileDraft {
  return {
    regions: [],
    acceptedEmploymentNatures: [...IN_SCOPE_EMPLOYMENT_NATURES],
  };
}

function isExpired(session: GuestProfileSession): boolean {
  return Date.now() > Date.parse(session.expiresAt);
}

// ==================== 采集选项（页面直接复用，避免文案散落） ====================

export const REGION_LEVEL_OPTIONS: {
  value: RegionPreferenceLevel;
  label: string;
  hint: string;
}[] = [
  { value: "required", label: "必须接受", hint: "只考虑这个地区" },
  { value: "preferred", label: "优先", hint: "更想去，优先排序" },
  { value: "consider", label: "可以考虑", hint: "有合适机会也愿意去" },
];

export const PROVINCE_OPTIONS: { code: string; name: string }[] = [
  { code: "110000", name: "北京市" },
  { code: "120000", name: "天津市" },
  { code: "130000", name: "河北省" },
  { code: "140000", name: "山西省" },
  { code: "150000", name: "内蒙古自治区" },
  { code: "210000", name: "辽宁省" },
  { code: "220000", name: "吉林省" },
  { code: "230000", name: "黑龙江省" },
  { code: "310000", name: "上海市" },
  { code: "320000", name: "江苏省" },
  { code: "330000", name: "浙江省" },
  { code: "340000", name: "安徽省" },
  { code: "350000", name: "福建省" },
  { code: "360000", name: "江西省" },
  { code: "370000", name: "山东省" },
  { code: "410000", name: "河南省" },
  { code: "420000", name: "湖北省" },
  { code: "430000", name: "湖南省" },
  { code: "440000", name: "广东省" },
  { code: "450000", name: "广西壮族自治区" },
  { code: "460000", name: "海南省" },
  { code: "500000", name: "重庆市" },
  { code: "510000", name: "四川省" },
  { code: "520000", name: "贵州省" },
  { code: "530000", name: "云南省" },
  { code: "540000", name: "西藏自治区" },
  { code: "610000", name: "陕西省" },
  { code: "620000", name: "甘肃省" },
  { code: "630000", name: "青海省" },
  { code: "640000", name: "宁夏回族自治区" },
  { code: "650000", name: "新疆维吾尔自治区" },
];

/**
 * 已收录城市（统计用区划码前 4 位）。
 * 演示公告集中在浙苏皖，因此这三省给到地级市；其他省份选“全省均可”即可，
 * 省级代码按前缀匹配，不影响省内机会筛选。
 */
export const CITY_OPTIONS: Record<string, { code: string; name: string }[]> = {
  "330000": [
    { code: "330100", name: "杭州市" },
    { code: "330200", name: "宁波市" },
    { code: "330300", name: "温州市" },
    { code: "330400", name: "嘉兴市" },
    { code: "330500", name: "湖州市" },
    { code: "330600", name: "绍兴市" },
    { code: "330700", name: "金华市" },
    { code: "330800", name: "衢州市" },
    { code: "330900", name: "舟山市" },
    { code: "331000", name: "台州市" },
    { code: "331100", name: "丽水市" },
  ],
  "320000": [
    { code: "320100", name: "南京市" },
    { code: "320200", name: "无锡市" },
    { code: "320300", name: "徐州市" },
    { code: "320400", name: "常州市" },
    { code: "320500", name: "苏州市" },
    { code: "320600", name: "南通市" },
    { code: "320700", name: "连云港市" },
    { code: "320800", name: "淮安市" },
    { code: "320900", name: "盐城市" },
    { code: "321000", name: "扬州市" },
    { code: "321100", name: "镇江市" },
    { code: "321200", name: "泰州市" },
    { code: "321300", name: "宿迁市" },
  ],
  "340000": [
    { code: "340100", name: "合肥市" },
    { code: "340200", name: "芜湖市" },
    { code: "340300", name: "蚌埠市" },
    { code: "340400", name: "淮南市" },
    { code: "340500", name: "马鞍山市" },
    { code: "340600", name: "淮北市" },
    { code: "340700", name: "铜陵市" },
    { code: "340800", name: "安庆市" },
    { code: "341000", name: "黄山市" },
    { code: "341100", name: "滁州市" },
    { code: "341200", name: "阜阳市" },
    { code: "341300", name: "宿州市" },
    { code: "341500", name: "六安市" },
    { code: "341600", name: "亳州市" },
    { code: "341700", name: "池州市" },
    { code: "341800", name: "宣城市" },
  ],
};

export const CREDENTIAL_LEVEL_OPTIONS: { value: CredentialLevel; label: string }[] = [
  { value: "secondary", label: "中专 / 高中" },
  { value: "college", label: "大专" },
  { value: "bachelor", label: "本科" },
  { value: "master", label: "硕士研究生" },
  { value: "doctorate", label: "博士研究生" },
];

export const DEGREE_OPTIONS: { value: DegreeCode; label: string }[] = [
  { value: "none", label: "没有学位" },
  { value: "bachelor", label: "学士学位" },
  { value: "master", label: "硕士学位" },
  { value: "doctorate", label: "博士学位" },
];

export const EMPLOYMENT_STATUS_OPTIONS: {
  value: EmploymentStatus;
  label: string;
  hint?: string;
}[] = [
  { value: "student", label: "在读，还没毕业" },
  { value: "fresh_unemployed", label: "已毕业，暂时没落实工作" },
  { value: "employed_fulltime", label: "已落实全职工作" },
  { value: "employed_parttime", label: "灵活就业 / 兼职" },
  { value: "other", label: "其他情况" },
];

export const TEACHER_CERT_STATUS_OPTIONS: {
  value: TeacherCertStatus;
  label: string;
  hint: string;
}[] = [
  { value: "obtained", label: "已经取得教师资格证", hint: "" },
  { value: "in_progress", label: "已通过考试，领证 / 认定中", hint: "" },
  { value: "none", label: "还没有教师资格证", hint: "" },
];

export const STAGE_OPTIONS: { value: StageCode; label: string }[] = [
  { value: "primary", label: "小学" },
  { value: "middle", label: "初中" },
  { value: "high", label: "高中" },
];

/**
 * 学科选项。当前仅语文开放匹配；其他学科仅用于识别意向，
 * 选中后不会进入机会匹配（previewEngine 返回 subject_not_open）。
 */
export const SUBJECT_OPTIONS: { value: SubjectCode; label: string }[] = [
  { value: "chinese", label: "语文" },
  { value: "math", label: "数学" },
  { value: "english", label: "英语" },
  { value: "physics", label: "物理" },
  { value: "chemistry", label: "化学" },
  { value: "biology", label: "生物" },
  { value: "politics", label: "道德与法治 / 政治" },
  { value: "history", label: "历史" },
  { value: "geography", label: "地理" },
  { value: "music", label: "音乐" },
  { value: "pe", label: "体育" },
  { value: "art", label: "美术" },
  { value: "it", label: "信息技术" },
  { value: "preschool", label: "幼教" },
  { value: "other", label: "其他学科" },
];

export function subjectLabel(code: SubjectCode | undefined): string {
  if (!code) return "其他学科";
  return SUBJECT_OPTIONS.find((s) => s.value === code)?.label ?? "其他学科";
}

// ==================== 分组完成度（页面“下一步”门禁唯一口径） ====================

export function isStepComplete(draft: GuestProfileDraft, step: number): boolean {
  switch (step) {
    case 1:
      return draft.regions.length > 0;
    case 2:
      return draft.educationLevel !== undefined && draft.degree !== undefined;
    case 3:
      return (draft.majorFullName ?? "").trim().length > 0;
    case 4:
      return !!draft.graduationDate && draft.employmentStatus !== undefined;
    case 5: {
      if (draft.acceptedEmploymentNatures.length === 0) return false;
      const cert = draft.teacherCert;
      if (!cert || !cert.status) return false;
      if (cert.status === "none") return draft.intendedSubject !== undefined;
      // 在途/已取得：学科与学段必填；在途还需预计取得时间（供匹配引擎判断）
      if (!cert.subject || !cert.stage) return false;
      if (cert.status === "in_progress" && !cert.expectedDate) return false;
      return draft.intendedSubject !== undefined;
    }
    default:
      return false;
  }
}

export function isDraftComplete(draft: GuestProfileDraft): boolean {
  for (let step = 1; step <= TOTAL_PROFILE_STEPS; step += 1) {
    if (!isStepComplete(draft, step)) return false;
  }
  return true;
}

/** 意向学科是否在当前开放范围（非语文明确分流，不产生匹配） */
export function isSubjectOpen(draft: GuestProfileDraft): boolean {
  return draft.intendedSubject === OPEN_SUBJECT;
}

/**
 * 把完整草稿映射为匹配引擎使用的画像。
 * 条件画像字段（出生/户籍/社保/工作经历）刻意不设置 → 引擎只能判 UNKNOWN。
 * 草稿不完整或学科未开放时返回 null（调用方负责回引导/未开放页）。
 */
export function draftToProfile(draft: GuestProfileDraft): UserRecruitmentProfile | null {
  if (!isDraftComplete(draft) || !isSubjectOpen(draft)) return null;
  return {
    regions: draft.regions,
    educationLevel: draft.educationLevel as CredentialLevel,
    degree: draft.degree as DegreeCode,
    majorFullName: (draft.majorFullName ?? "").trim(),
    graduationDate: draft.graduationDate,
    employmentStatus: draft.employmentStatus as UserRecruitmentProfile["employmentStatus"],
    teacherCert: draft.teacherCert as TeacherCertInfo,
    acceptedEmploymentNatures: draft.acceptedEmploymentNatures,
  };
}

// ==================== 会话存储服务 ====================

export const guestSessionService = {
  /** 读取访客画像会话；不存在或已过期时返回 null（过期会同时清除） */
  load(): GuestProfileSession | null {
    const session = loadFromStorage<GuestProfileSession | null>(
      STORAGE_KEYS.GUEST_PROFILE_V61,
      null,
    );
    if (!session) return null;
    if (isExpired(session)) {
      removeFromStorage(STORAGE_KEYS.GUEST_PROFILE_V61);
      return null;
    }
    return session;
  },

  /** 创建或更新会话（草稿浅合并，整组覆盖；可随时返回修改） */
  save(patch: { draft?: Partial<GuestProfileDraft>; step?: number }): GuestProfileSession {
    const existing = this.load();
    const now = new Date().toISOString();
    const next: GuestProfileSession = {
      draft: { ...emptyDraft(), ...existing?.draft, ...patch.draft },
      step: patch.step ?? existing?.step ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      expiresAt: existing?.expiresAt ?? new Date(Date.now() + GUEST_TTL_MS).toISOString(),
    };
    saveToStorage(STORAGE_KEYS.GUEST_PROFILE_V61, next);
    return next;
  },

  /** 是否已开始但未完成五组采集 */
  isInProgress(): boolean {
    const s = this.load();
    return !!s && s.step > 0 && s.step < TOTAL_PROFILE_STEPS;
  },

  /** 是否已完成五组采集（含非语文学科的终态），可以查看初步结果 */
  isComplete(): boolean {
    const s = this.load();
    return !!s && s.step >= TOTAL_PROFILE_STEPS;
  },

  clear(): void {
    removeFromStorage(STORAGE_KEYS.GUEST_PROFILE_V61);
  },
};
