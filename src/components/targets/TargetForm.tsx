"use client";

import { useState } from "react";
import {
  EducationLevel,
  ExamStage,
  ExamTargetInput,
  ExamType,
  TargetCandidate,
  TargetStatus,
  EDUCATION_LEVEL_LABELS,
  EXAM_STAGE_LABELS,
  EXAM_TYPE_LABELS,
  SUBJECT_LABELS,
  TARGET_STATUS_LABELS,
} from "@/types";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const STATUS_OPTIONS: {
  value: TargetStatus;
  title: string;
  description: string;
  icon: string;
}[] = [
  { value: "announcement", title: TARGET_STATUS_LABELS.announcement, description: "已找到官方招聘公告或考试大纲", icon: "📄" },
  { value: "region", title: "已确定地区，但暂无公告", description: "确定要考某个地区/单位，公告尚未发布", icon: "📍" },
  { value: "candidates", title: "有几个候选地区或学段", description: "还在比较不同地区或学段", icon: "🤔" },
  { value: "subject", title: "只确定了语文学科", description: "还没确定考哪里，只知道考语文", icon: "📖" },
];

type SaveMode = "confirm" | "draft";

interface TargetFormProps {
  /** create：显示四种入口选择；edit：编辑已有目标 */
  mode: "create" | "edit";
  initial?: Partial<ExamTargetInput>;
  submitting?: boolean;
  /** 保存失败或校验错误信息（由 service 抛出） */
  errorMessage?: string | null;
  onSubmit: (input: ExamTargetInput, saveMode: SaveMode) => void;
  onCancel?: () => void;
}

function emptyCandidate(index: number): TargetCandidate {
  return { id: `c-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}` };
}

export function TargetForm({
  mode,
  initial,
  submitting = false,
  errorMessage,
  onSubmit,
  onCancel,
}: TargetFormProps) {
  const [targetStatus, setTargetStatus] = useState<TargetStatus | null>(
    initial?.targetStatus ?? (mode === "edit" ? "region" : null)
  );
  const [province, setProvince] = useState(initial?.province ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [recruiter, setRecruiter] = useState(initial?.recruiter ?? "");
  const [examType, setExamType] = useState<ExamType | "">(
    initial?.examType ?? ""
  );
  const [year, setYear] = useState<string>(initial?.year ? String(initial.year) : "");
  const [batch, setBatch] = useState(initial?.batch ?? "");
  const [educationLevel, setEducationLevel] = useState<EducationLevel | "">(
    initial?.educationLevel ?? ""
  );
  const [stage, setStage] = useState<ExamStage>(initial?.stage ?? "preparation");
  const [announcementUrl, setAnnouncementUrl] = useState(initial?.announcementUrl ?? "");
  const [candidates, setCandidates] = useState<TargetCandidate[]>(
    initial?.candidates?.length
      ? initial.candidates
      : [emptyCandidate(0), emptyCandidate(1)]
  );

  const collect = (): ExamTargetInput => ({
    targetStatus: targetStatus!,
    province: province.trim() || undefined,
    city: city.trim() || undefined,
    recruiter: recruiter.trim() || undefined,
    examType: examType || undefined,
    year: year ? parseInt(year, 10) || undefined : undefined,
    batch: batch.trim() || undefined,
    educationLevel: educationLevel || undefined,
    stage,
    announcementUrl: announcementUrl.trim() || undefined,
    candidates: targetStatus === "candidates" ? candidates : undefined,
    // 编辑时保留已确认的本周方向，不被表单覆盖
    confirmedCandidateId: initial?.confirmedCandidateId,
  });

  const updateCandidate = (id: string, patch: Partial<TargetCandidate>) => {
    setCandidates((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  return (
    <div className="space-y-5">
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <span aria-hidden>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 学科固定 */}
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
        <span className="text-sm text-slate-600">学科</span>
        <Badge variant="primary">{SUBJECT_LABELS.chinese}（固定）</Badge>
      </div>

      {/* 目标状态 */}
      {mode === "create" ? (
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">你的目标状态</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTargetStatus(opt.value)}
                className={`flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                  targetStatus === opt.value
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="text-xl">{opt.icon}</span>
                <span>
                  <span className="block text-sm font-medium text-slate-900">{opt.title}</span>
                  <span className="block text-xs text-slate-500 mt-0.5">{opt.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">目标状态</span>
          <Badge>{targetStatus ? TARGET_STATUS_LABELS[targetStatus] : ""}</Badge>
        </div>
      )}

      {targetStatus === "candidates" ? (
        /* ============ 候选方向 ============ */
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            填写你正在比较的候选地区/学段，保存后在“我的考试”中确认一个本周主攻方向。
          </p>
          {candidates.map((c, i) => (
            <div key={c.id} className="rounded-xl border border-slate-200 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">候选 {i + 1}</span>
                {candidates.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setCandidates((list) => list.filter((x) => x.id !== c.id))}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    删除
                  </button>
                )}
              </div>
              <Input
                label="省份"
                placeholder="例如：浙江省"
                value={c.province ?? ""}
                onChange={(e) => updateCandidate(c.id, { province: e.target.value })}
              />
              <Input
                label="城市"
                placeholder="例如：杭州市"
                value={c.city ?? ""}
                onChange={(e) => updateCandidate(c.id, { city: e.target.value })}
              />
              <Select
                label="学段（可后补）"
                placeholder="暂不确定"
                options={Object.entries(EDUCATION_LEVEL_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                value={c.educationLevel ?? ""}
                onChange={(e) =>
                  updateCandidate(c.id, {
                    educationLevel: e.target.value ? (e.target.value as EducationLevel) : undefined,
                  })
                }
              />
            </div>
          ))}
          {candidates.length < 4 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCandidates((list) => [...list, emptyCandidate(list.length)])}
            >
              + 添加候选
            </Button>
          )}
        </div>
      ) : (
        /* ============ 常规字段 ============ */
        <div className="space-y-4">
          {targetStatus === "subject" && (
            <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
              只确定学科也可以先保存，系统会生成 1-3 个查找任务帮你澄清地区与学段，
              不会直接生成看似精确的学习计划。
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="省份"
              required={targetStatus === "announcement" || targetStatus === "region"}
              placeholder="例如：浙江省"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
            />
            <Input
              label={targetStatus === "region" ? "城市（或招聘单位/批次）" : "城市"}
              placeholder="例如：杭州市"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          {(targetStatus === "announcement" || targetStatus === "region") && (
            <Input
              label="招聘单位（可与城市二选一填写）"
              placeholder="例如：杭州市教育局直属学校"
              value={recruiter}
              onChange={(e) => setRecruiter(e.target.value)}
              hint="没有明确城市时，填写具体招聘单位或批次也可以"
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="学段"
              placeholder={targetStatus === "subject" ? "暂不确定" : "请选择学段"}
              options={Object.entries(EDUCATION_LEVEL_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              value={educationLevel}
              onChange={(e) =>
                setEducationLevel(e.target.value ? (e.target.value as EducationLevel) : "")
              }
            />
            <Select
              label="招聘类型"
              placeholder="暂不确定"
              options={Object.entries(EXAM_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              value={examType}
              onChange={(e) => setExamType(e.target.value ? (e.target.value as ExamType) : "")}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="年份"
              type="number"
              placeholder="例如：2026"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
            <Input
              label="批次"
              placeholder="例如：上半年统招"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
            />
            <Select
              label="考试阶段"
              options={Object.entries(EXAM_STAGE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              value={stage}
              onChange={(e) => setStage(e.target.value as ExamStage)}
            />
          </div>

          {targetStatus === "announcement" && (
            <>
              <Input
                label="公告链接"
                required
                placeholder="粘贴官方公告网页链接"
                value={announcementUrl}
                onChange={(e) => setAnnouncementUrl(e.target.value)}
                hint="目标确认后，可在「我的考试 → 提交公告」粘贴公告正文进行字段提取，或使用文件入口（当前为占位）"
              />
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center">
                <p className="text-sm text-slate-500">📎 公告文件上传（PDF / 图片）为占位能力，请在目标确认后于「我的考试 → 提交公告」查看</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            取消
          </Button>
        )}
        {mode === "create" && targetStatus && (
          <Button
            variant="outline"
            onClick={() => onSubmit(collect(), "draft")}
            disabled={submitting}
          >
            {submitting ? "保存中..." : "保存草稿"}
          </Button>
        )}
        <Button
          onClick={() => onSubmit(collect(), "confirm")}
          disabled={!targetStatus || submitting}
        >
          {submitting
            ? "保存中..."
            : mode === "edit"
              ? "保存修改"
              : "确认并继续"}
        </Button>
      </div>
    </div>
  );
}
