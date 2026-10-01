"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { TargetForm } from "@/components/targets/TargetForm";
import { examTargetService } from "@/lib/services";
import { ExamTargetInput } from "@/types";

export default function OnboardingPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (input: ExamTargetInput, saveMode: "confirm" | "draft") => {
    setIsSubmitting(true);
    setErrorMessage(null);

    // 模拟网络延迟
    await new Promise((r) => setTimeout(r, 400));

    try {
      if (saveMode === "draft") {
        examTargetService.saveDraft(input);
      } else {
        examTargetService.confirmTarget(input);
      }
      // 无论确认还是草稿，都进入“我的考试”：
      // 条件充分进入考情核验，条件不足只显示澄清任务
      router.push("/exam");
    } catch (e) {
      // 保存失败（校验不通过或本地存储不可用）：留在当前页，可重试
      setErrorMessage(e instanceof Error ? e.message : "保存失败，请稍后重试");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📝</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">先明确你正在准备哪一次考试</h1>
          <p className="text-slate-600 text-sm">
            信息不足时我们只会生成澄清任务，不会编造看似精确的学习计划
          </p>
        </div>

        <Card className="mb-4">
          <TargetForm
            mode="create"
            submitting={isSubmitting}
            errorMessage={errorMessage}
            onSubmit={handleSubmit}
          />
        </Card>

        <p className="text-center text-xs text-slate-400">
          你的信息仅用于提供个性化备考服务 ·{" "}
          <Link href="/exam" className="text-blue-600 hover:underline">
            返回我的考试
          </Link>
        </p>
      </div>
    </div>
  );
}
