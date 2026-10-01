"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { ExamTargetFormData, ExamType, EducationLevel } from "@/types";
import { EXAM_TYPE_LABELS, EDUCATION_LEVEL_LABELS } from "@/types";
import { examTargetService } from "@/lib/services";

type TargetStatus = "announcement" | "region" | "candidates" | "subject";

const statusOptions: {
  value: TargetStatus;
  title: string;
  description: string;
  icon: string;
}[] = [
  {
    value: "announcement",
    title: "我已经有明确公告",
    description: "已找到官方发布的招聘公告或考试大纲",
    icon: "📄",
  },
  {
    value: "region",
    title: "我已经确定地区，但还没有公告",
    description: "确定要考某个地区，但公告尚未发布或没找到",
    icon: "📍",
  },
  {
    value: "candidates",
    title: "我有几个候选地区或学段",
    description: "还在比较不同地区或学段的选择",
    icon: "🤔",
  },
  {
    value: "subject",
    title: "我只确定了语文学科",
    description: "还没确定考哪里，只知道要考语文",
    icon: "📖",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [targetStatus, setTargetStatus] = useState<TargetStatus | null>(null);
  const [formData, setFormData] = useState<Partial<ExamTargetFormData>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};

    if (!targetStatus) {
      newErrors.status = "请选择你的目标状态";
    }

    if (targetStatus !== "subject") {
      if (!formData.region) newErrors.region = "请选择或输入目标地区";
      if (!formData.educationLevel) newErrors.educationLevel = "请选择学段";
      if (!formData.examType) newErrors.examType = "请选择招聘类型";
    }

    if (targetStatus === "announcement" && !formData.announcementUrl) {
      newErrors.announcementUrl = "请提供公告链接或上传文件";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);

    // 模拟保存
    await new Promise((r) => setTimeout(r, 500));

    if (targetStatus === "announcement" || targetStatus === "region") {
      examTargetService.create({
        name: `${formData.region} ${EDUCATION_LEVEL_LABELS[formData.educationLevel as EducationLevel]} ${EXAM_TYPE_LABELS[formData.examType as ExamType]}`,
        region: formData.region!,
        regionCode: "330100",
        examType: formData.examType!,
        educationLevel: formData.educationLevel!,
        year: 2026,
        stage: "preparation",
        status: "confirmed",
        isCurrent: true,
        announcementUrl: formData.announcementUrl,
      });
    }

    router.push("/exam");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-slate-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📝</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            语文教师编备考助手
          </h1>
          <p className="text-slate-600">
            帮你核对考什么、判断资料怎么用、安排接下来 7 天
          </p>
        </div>

        {/* Step 1: 目标状态 */}
        <Card className="mb-6">
          <CardHeader title="你的目标状态" description="选择最符合你当前情况的选项" />
          <div className="space-y-3">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setTargetStatus(opt.value);
                  setErrors({});
                }}
                className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                  targetStatus === opt.value
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="text-2xl">{opt.icon}</span>
                <div>
                  <p className="font-medium text-slate-900">{opt.title}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{opt.description}</p>
                </div>
              </button>
            ))}
          </div>
          {errors.status && (
            <p className="mt-2 text-sm text-red-600">{errors.status}</p>
          )}
        </Card>

        {/* Step 2: 基础信息 */}
        {targetStatus && targetStatus !== "subject" && (
          <Card className="mb-6">
            <CardHeader title="基础信息" description="填写你目标考试的基本信息" />
            <div className="space-y-4">
              <Input
                label="目标地区"
                placeholder="例如：浙江省杭州市"
                value={formData.region || ""}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, region: e.target.value }))
                }
                error={errors.region}
              />
              <Select
                label="学段"
                placeholder="请选择学段"
                options={Object.entries(EDUCATION_LEVEL_LABELS).map(([v, l]) => ({
                  value: v,
                  label: l,
                }))}
                value={formData.educationLevel || ""}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    educationLevel: e.target.value as EducationLevel,
                  }))
                }
                error={errors.educationLevel}
              />
              <Select
                label="招聘类型"
                placeholder="请选择招聘类型"
                options={Object.entries(EXAM_TYPE_LABELS).map(([v, l]) => ({
                  value: v,
                  label: l,
                }))}
                value={formData.examType || ""}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    examType: e.target.value as ExamType,
                  }))
                }
                error={errors.examType}
              />
              {targetStatus === "announcement" && (
                <Input
                  label="公告链接"
                  placeholder="粘贴公告的网页链接"
                  value={formData.announcementUrl || ""}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, announcementUrl: e.target.value }))
                  }
                  error={errors.announcementUrl}
                  hint="也可以直接上传公告截图或PDF"
                />
              )}
            </div>
          </Card>
        )}

        {/* 公告上传占位 */}
        {targetStatus === "announcement" && (
          <Card className="mb-6">
            <CardHeader title="上传公告文件" description="支持 PDF、图片格式" />
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer">
              <svg
                className="w-10 h-10 text-slate-400 mx-auto mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-sm text-slate-600">点击上传或拖拽文件到此处</p>
              <p className="text-xs text-slate-400 mt-1">支持 PDF、JPG、PNG</p>
            </div>
          </Card>
        )}

        {/* 目标未定提示 */}
        {targetStatus === "subject" && (
          <Card className="mb-6">
            <CardHeader title="目标澄清" description="先帮你缩小选择范围" />
            <div className="space-y-4">
              <Input
                label="意向地区（可多选）"
                placeholder="例如：浙江省杭州市、江苏省南京市"
                value={formData.region || ""}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, region: e.target.value }))
                }
              />
              <Select
                label="意向学段"
                placeholder="请选择学段"
                options={Object.entries(EDUCATION_LEVEL_LABELS).map(([v, l]) => ({
                  value: v,
                  label: l,
                }))}
                value={formData.educationLevel || ""}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    educationLevel: e.target.value as EducationLevel,
                  }))
                }
              />
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  我们会根据你的意向，提供本周需要完成的 1-3 个目标选择任务，
                  帮助你尽快确定备考方向。
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Submit */}
        <Button
          fullWidth
          size="lg"
          onClick={handleSubmit}
          disabled={!targetStatus || isSubmitting}
        >
          {isSubmitting ? "保存中..." : "保存并继续"}
        </Button>

        <p className="text-center text-xs text-slate-400 mt-4">
          你的信息仅用于提供个性化备考服务
        </p>
      </div>
    </div>
  );
}
