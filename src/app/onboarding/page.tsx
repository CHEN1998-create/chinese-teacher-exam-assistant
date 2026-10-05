"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useCurrentUser, AUTH_MODE } from "@/lib/auth";
import {
  CITY_OPTIONS,
  CREDENTIAL_LEVEL_OPTIONS,
  DEGREE_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  PROVINCE_OPTIONS,
  REGION_LEVEL_OPTIONS,
  STAGE_OPTIONS,
  SUBJECT_OPTIONS,
  TEACHER_CERT_STATUS_OPTIONS,
  TOTAL_PROFILE_STEPS,
  draftToProfile,
  guestSessionService,
  isStepComplete,
  type GuestProfileDraft,
} from "@/lib/guest/guestSession";
import { profileApi } from "@/lib/profile/profileApi";
import type { EmploymentNatureCode, SubjectCode } from "@/lib/announcements/types";
import type {
  RegionPreference,
  RegionPreferenceLevel,
  TeacherCertInfo,
} from "@/lib/profile/types";
import { NATURE_SHORT_LABELS } from "@/lib/ia/labels";

/**
 * v6.1 五组基础画像采集（一次只问一组）：
 * 1. 可接受地区（必须接受 / 优先 / 可以考虑）
 * 2. 最高学历和学位
 * 3. 毕业证专业全称
 * 4. 毕业时间和当前就业状态
 * 5. 教师资格（状态/学科/学段）+ 用工形式接受程度
 *
 * - 未登录可完成，草稿自动保存在本机浏览器，刷新可恢复；
 * - 随时返回修改，已填内容保留；
 * - 年龄/户籍/社保/工作经历不在此收齐，结果页按需说明补问原因；
 * - 意向学科非语文时明确提示尚未开放，可留下意向，不生成虚假匹配；
 * - 完成后进入 /preview 查看初步机会，关注时才要求登录。
 */

const STEP_TITLES = [
  "你能接受去哪些地区当老师？",
  "你的最高学历和学位？",
  "毕业证上写的专业全称是什么？",
  "你什么时候毕业？现在是什么状态？",
  "你的教师资格情况？",
];

export default function OnboardingPage() {
  const router = useRouter();
  const { status } = useCurrentUser();

  // 惰性初始化从 localStorage 恢复，避免 effect 内 setState
  const [draft, setDraft] = useState<GuestProfileDraft>(() => {
    if (typeof window === "undefined") {
      return { regions: [], acceptedEmploymentNatures: [] };
    }
    return guestSessionService.load()?.draft ?? {
      regions: [],
      acceptedEmploymentNatures: [],
    };
  });

  const [view, setView] = useState(() => {
    if (typeof window === "undefined") return 1;
    const session = guestSessionService.load();
    if (!session || session.step <= 0) return 1;
    if (session.step >= TOTAL_PROFILE_STEPS) return 1; // effect 会 replace 到结果页
    return Math.min(session.step + 1, TOTAL_PROFILE_STEPS);
  });

  useEffect(() => {
    if (status === "loading") return;
    if (status === "authenticated") {
      router.replace("/opportunities");
      return;
    }
    if (guestSessionService.isComplete()) {
      router.replace("/preview");
    }
  }, [status, router]);

  const updateDraft = (patch: Partial<GuestProfileDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  /** 进入下一组：保存草稿与完成进度。
   *  invited 模式下若草稿已完整，同步持久化到服务端（跨浏览器恢复）。 */
  const goNext = () => {
    const finishedStep = view;
    guestSessionService.save({ draft, step: finishedStep });
    if (AUTH_MODE === "invited") {
      const profile = draftToProfile(draft);
      if (profile) profileApi.saveProfile(profile).catch(() => undefined);
    }
    if (finishedStep >= TOTAL_PROFILE_STEPS) {
      router.push("/preview");
    } else {
      setView(finishedStep + 1);
    }
  };

  /** 返回上一组：草稿照样保留（即使本组尚未答完） */
  const goBack = () => {
    guestSessionService.save({ draft });
    setView((v) => Math.max(v - 1, 1));
  };

  if (status === "loading") return null;

  const canContinue = isStepComplete(draft, view);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
            ← 返回首页
          </Link>
          <span className="text-xs text-slate-400">
            第 {view} 组，共 {TOTAL_PROFILE_STEPS} 组
          </span>
        </div>

        {/* 进度条 */}
        <div className="flex gap-2 mb-6" aria-hidden="true">
          {Array.from({ length: TOTAL_PROFILE_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < view ? "bg-blue-500" : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        <Card>
          <h1 className="text-lg font-bold text-slate-900 mb-1">{STEP_TITLES[view - 1]}</h1>

          {view === 1 && <StepRegions value={draft.regions} onChange={(regions) => updateDraft({ regions })} />}
          {view === 2 && (
            <StepEducation
              educationLevel={draft.educationLevel}
              degree={draft.degree}
              onChange={(patch) => updateDraft(patch)}
            />
          )}
          {view === 3 && (
            <StepMajor
              major={draft.majorFullName ?? ""}
              onChange={(majorFullName) => updateDraft({ majorFullName })}
            />
          )}
          {view === 4 && (
            <StepGraduation
              graduationDate={draft.graduationDate ?? ""}
              employmentStatus={draft.employmentStatus}
              onChange={(patch) => updateDraft(patch)}
            />
          )}
          {view === 5 && <StepCert draft={draft} onChange={updateDraft} />}

          <div className="mt-6">
            <Button onClick={goNext} disabled={!canContinue} size="lg" fullWidth>
              {view >= TOTAL_PROFILE_STEPS ? "查看初步匹配结果" : "下一步"}
            </Button>
            {!canContinue && (
              <p className="text-xs text-slate-400 text-center mt-2">完成本页问题后才能继续</p>
            )}
          </div>
        </Card>

        {view > 1 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={goBack}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              返回上一组
            </button>
          </div>
        )}

        <p className="text-center text-xs text-slate-400 mt-6">
          当前输入仅保存在本机浏览器，不会上传到服务器。
          <Link href="/login" className="text-blue-600 hover:underline ml-1">
            已有账号？直接登录
          </Link>
        </p>
      </div>
    </div>
  );
}

/* ================== 第 1 组：可接受地区 ================== */

function regionFromSelect(
  provinceCode: string,
  cityCode: string,
  level: RegionPreferenceLevel,
): RegionPreference {
  const province = PROVINCE_OPTIONS.find((p) => p.code === provinceCode);
  if (cityCode) {
    const city = CITY_OPTIONS[provinceCode]?.find((c) => c.code === cityCode);
    return {
      code: cityCode,
      province: province?.name ?? "",
      city: city?.name,
      level,
    };
  }
  return { code: provinceCode, province: province?.name ?? "", level };
}

function StepRegions({
  value,
  onChange,
}: {
  value: RegionPreference[];
  onChange: (regions: RegionPreference[]) => void;
}) {
  // 至少保证一行可编辑
  const rows = value.length > 0 ? value : [];

  const updateRow = (index: number, next: RegionPreference) => {
    onChange(rows.map((r, i) => (i === index ? next : r)));
  };
  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };
  const addRow = () => {
    onChange([
      ...rows,
      { code: "330000", province: "浙江省", level: "consider" },
    ]);
  };

  return (
    <div className="mt-4">
      <p className="text-sm text-slate-500 mb-4">
        可以填多个地区；招聘只按你能接受的地区筛选，不会推荐你明确不去的地方。
      </p>
      <div className="space-y-4">
        {(rows.length > 0 ? rows : []).map((region, index) => {
          const provinceCode = region.code.endsWith("0000")
            ? region.code
            : `${region.code.slice(0, 2)}0000`;
          const cityCode = region.code.endsWith("0000") ? "" : region.code;
          const cities = CITY_OPTIONS[provinceCode] ?? [];
          return (
            <div key={index} className="rounded-xl border border-slate-200 p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-slate-500">省份</span>
                  <select
                    value={provinceCode}
                    onChange={(e) =>
                      updateRow(index, regionFromSelect(e.target.value, "", region.level))
                    }
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PROVINCE_OPTIONS.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">城市（不选=全省均可）</span>
                  <select
                    value={cityCode}
                    onChange={(e) =>
                      updateRow(index, regionFromSelect(provinceCode, e.target.value, region.level))
                    }
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">全省均可</option>
                    {cities.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <span className="text-xs text-slate-500">接受程度</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {REGION_LEVEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        updateRow(index, regionFromSelect(provinceCode, cityCode, opt.value))
                      }
                      title={opt.hint}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        region.level === opt.value
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="text-xs text-slate-400 hover:text-red-600"
                >
                  删除这个地区
                </button>
              )}
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center">
            <button
              type="button"
              onClick={() => onChange([{ code: "330000", province: "浙江省", level: "required" }])}
              className="text-sm text-blue-600 hover:underline"
            >
              添加第一个地区
            </button>
          </div>
        )}
      </div>
      {rows.length > 0 && (
        <button
          type="button"
          onClick={addRow}
          className="mt-3 text-sm text-blue-600 hover:underline"
        >
          + 再加一个可以考虑的地区
        </button>
      )}
    </div>
  );
}

/* ================== 第 2 组：学历学位 ================== */

function OptionList<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          className={`text-left p-3 rounded-xl border text-sm transition-colors ${
            value === opt.value
              ? "border-blue-500 bg-blue-50 text-slate-900"
              : "border-slate-200 text-slate-700 hover:border-blue-300"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function StepEducation({
  educationLevel,
  degree,
  onChange,
}: {
  educationLevel: GuestProfileDraft["educationLevel"];
  degree: GuestProfileDraft["degree"];
  onChange: (patch: Partial<GuestProfileDraft>) => void;
}) {
  return (
    <div className="mt-4 space-y-5">
      <div>
        <p className="text-sm text-slate-500 mb-2">最高学历（按已经取得或即将取得的毕业证填写）</p>
        <OptionList
          options={CREDENTIAL_LEVEL_OPTIONS}
          value={educationLevel}
          onSelect={(v) => onChange({ educationLevel: v })}
        />
      </div>
      <div>
        <p className="text-sm text-slate-500 mb-2">最高学位</p>
        <OptionList
          options={DEGREE_OPTIONS}
          value={degree}
          onSelect={(v) => onChange({ degree: v })}
        />
      </div>
    </div>
  );
}

/* ================== 第 3 组：专业全称 ================== */

function StepMajor({
  major,
  onChange,
}: {
  major: string;
  onChange: (major: string) => void;
}) {
  return (
    <div className="mt-4">
      <p className="text-sm text-slate-500 mb-3">
        请按毕业证（或预期毕业证）上的名称完整填写，含括号里的方向，例如“汉语言文学（师范）”。
      </p>
      <input
        value={major}
        onChange={(e) => onChange(e.target.value)}
        placeholder="毕业证专业全称"
        className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <p className="text-xs text-slate-400 mt-2">
        专业目录存在解释空间（如“相关专业”）时，不会自动判定，会提示你向招聘单位确认。
      </p>
    </div>
  );
}

/* ================== 第 4 组：毕业时间与就业状态 ================== */

function StepGraduation({
  graduationDate,
  employmentStatus,
  onChange,
}: {
  graduationDate: string;
  employmentStatus: GuestProfileDraft["employmentStatus"];
  onChange: (patch: Partial<GuestProfileDraft>) => void;
}) {
  // 存储 YYYY-MM-DD；input[type=month] 使用 YYYY-MM
  const monthValue = graduationDate.slice(0, 7);
  return (
    <div className="mt-4 space-y-5">
      <div>
        <p className="text-sm text-slate-500 mb-2">毕业（或预计毕业）时间</p>
        <input
          type="month"
          value={monthValue}
          onChange={(e) =>
            onChange({ graduationDate: e.target.value ? `${e.target.value}-15` : undefined })
          }
          className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-slate-400 mt-2">
          只记录毕业时间这一事实，不给你贴“应届生”标签；是否算应届按每条公告口径逐次判断。
        </p>
      </div>
      <div>
        <p className="text-sm text-slate-500 mb-2">当前状态</p>
        <OptionList
          options={EMPLOYMENT_STATUS_OPTIONS}
          value={employmentStatus}
          onSelect={(v) => onChange({ employmentStatus: v })}
        />
      </div>
    </div>
  );
}

/* ================== 第 5 组：教师资格 + 用工形式 ================== */

const NATURE_OPTIONS: { value: EmploymentNatureCode; label: string }[] = [
  { value: "public_institution_staff", label: NATURE_SHORT_LABELS.public_institution_staff },
  { value: "record_filing", label: NATURE_SHORT_LABELS.record_filing },
  { value: "post_quota", label: NATURE_SHORT_LABELS.post_quota },
  { value: "headcount_control", label: NATURE_SHORT_LABELS.headcount_control },
  { value: "other", label: NATURE_SHORT_LABELS.other },
];

function StepCert({
  draft,
  onChange,
}: {
  draft: GuestProfileDraft;
  onChange: (patch: Partial<GuestProfileDraft>) => void;
}) {
  const cert: TeacherCertInfo = draft.teacherCert ?? { status: "obtained" };
  const certNone = cert.status === "none";
  const subjectValue = certNone ? draft.intendedSubject : cert.subject;
  const subjectOpen = subjectValue === "chinese";

  const updateCert = (patch: Partial<TeacherCertInfo>) => {
    const nextCert = { ...cert, ...patch };
    onChange({
      teacherCert: nextCert,
      // 有证/在途时，报考学科跟随资格证学科；无证时由单独的意向学科选择决定
      intendedSubject: nextCert.status === "none" ? draft.intendedSubject : nextCert.subject,
    });
  };

  const changeStatus = (status: TeacherCertInfo["status"]) => {
    if (status === "none") {
      onChange({
        teacherCert: { status },
        intendedSubject: draft.intendedSubject ?? "chinese",
      });
    } else {
      const nextCert: TeacherCertInfo = {
        status,
        subject: cert.subject ?? "chinese",
        stage: cert.stage ?? "middle",
        ...(status === "in_progress" ? { expectedDate: cert.expectedDate } : {}),
      };
      onChange({ teacherCert: nextCert, intendedSubject: nextCert.subject });
    }
  };

  const changeIntendedSubject = (subject: SubjectCode) => {
    if (certNone) {
      onChange({ intendedSubject: subject });
    } else {
      updateCert({ subject });
    }
  };

  const toggleNature = (code: EmploymentNatureCode) => {
    const set = new Set(draft.acceptedEmploymentNatures);
    if (set.has(code)) set.delete(code);
    else set.add(code);
    onChange({
      acceptedEmploymentNatures: NATURE_OPTIONS.filter((n) => set.has(n.value)).map(
        (n) => n.value,
      ),
    });
  };

  return (
    <div className="mt-4 space-y-5">
      <div>
        <p className="text-sm text-slate-500 mb-2">教师资格</p>
        <OptionList
          options={TEACHER_CERT_STATUS_OPTIONS}
          value={cert.status}
          onSelect={changeStatus}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-slate-500">
            {certNone ? "想报考的学科" : "资格证学科"}
          </span>
          <select
            value={subjectValue ?? ""}
            onChange={(e) => changeIntendedSubject(e.target.value)}
            className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SUBJECT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {!certNone && (
          <label className="block">
            <span className="text-xs text-slate-500">资格证学段</span>
            <select
              value={cert.stage ?? ""}
              onChange={(e) => updateCert({ stage: e.target.value as TeacherCertInfo["stage"] })}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STAGE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {cert.status === "in_progress" && (
        <label className="block">
          <span className="text-xs text-slate-500">预计取得教师资格时间</span>
          <input
            type="month"
            value={cert.expectedDate?.slice(0, 7) ?? ""}
            onChange={(e) =>
              updateCert({ expectedDate: e.target.value ? `${e.target.value}-15` : undefined })
            }
            className="mt-1 w-full h-11 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      )}

      {!subjectOpen && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          当前先开放<strong>语文</strong>教师公开招聘；其他学科暂未开放匹配，完成后可以在结果页留下开注意向，
          不会为你生成不相关的匹配结果。
        </div>
      )}

      <div>
        <p className="text-sm text-slate-500 mb-2">
          能接受哪些官方用工形式？（至少选一项）
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {NATURE_OPTIONS.map((opt) => {
            const checked = draft.acceptedEmploymentNatures.includes(opt.value);
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-2 p-3 rounded-xl border text-sm cursor-pointer transition-colors ${
                  checked
                    ? "border-blue-500 bg-blue-50 text-slate-900"
                    : "border-slate-200 text-slate-700 hover:border-blue-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleNature(opt.value)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
