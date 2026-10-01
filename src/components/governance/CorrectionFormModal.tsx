"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { correctionService } from "@/lib/governance/correctionService";
import { EVIDENCE_TYPE_LABELS, EvidenceType } from "@/types";

export interface CorrectionPreset {
  /** 预设的考情字段 key；空串表示字段缺失/手动选择 */
  field?: string;
  fieldLabel?: string;
  currentValue?: string;
  evidenceItemId?: string;
}

interface CorrectionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  examTargetId: string;
  preset?: CorrectionPreset | null;
  /** 每次打开传入新的 key 值，用于重置表单内部状态 */
  formKey: string;
  onSubmitted?: () => void;
}

interface SourceRow {
  url: string;
  note: string;
}

export function CorrectionFormModal({
  isOpen,
  onClose,
  examTargetId,
  preset,
  formKey,
  onSubmitted,
}: CorrectionFormModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="提交纠错">
      {isOpen && (
        <CorrectionForm
          key={formKey}
          examTargetId={examTargetId}
          preset={preset ?? null}
          onDone={() => {
            onSubmitted?.();
            onClose();
          }}
          onCancel={onClose}
        />
      )}
    </Modal>
  );
}

function CorrectionForm({
  examTargetId,
  preset,
  onDone,
  onCancel,
}: {
  examTargetId: string;
  preset: CorrectionPreset | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [targetType, setTargetType] = useState<"evidence" | "other">(
    preset?.field !== undefined && preset.field === "" && !preset.evidenceItemId ? "evidence" : "evidence"
  );
  const [field, setField] = useState(preset?.field ?? "");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [suggestedValue, setSuggestedValue] = useState("");
  const [sources, setSources] = useState<SourceRow[]>([{ url: "", note: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lockedField = !!preset?.field;
  const fieldLabel = field
    ? EVIDENCE_TYPE_LABELS[field as EvidenceType] ?? field
    : "";

  const updateSource = (index: number, patch: Partial<SourceRow>) => {
    setSources((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const addSource = () => setSources((rows) => [...rows, { url: "", note: "" }]);
  const removeSource = (index: number) =>
    setSources((rows) => rows.filter((_, i) => i !== index));

  const handleSubmit = () => {
    setError(null);
    setSubmitting(true);
    try {
      correctionService.submit({
        targetType,
        examTargetId,
        evidenceItemId: preset?.evidenceItemId,
        field: targetType === "evidence" ? field : "",
        fieldLabel: targetType === "evidence" ? fieldLabel : undefined,
        subject: targetType === "other" ? subject : undefined,
        currentValue: preset?.currentValue ?? "",
        description,
        suggestedValue,
        sources,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败，请重试");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          ⚠️ {error}
        </div>
      )}

      {/* 纠错对象类型 */}
      <div>
        <span className="block text-sm font-medium text-slate-700 mb-1.5">纠错对象</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTargetType("evidence")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
              targetType === "evidence"
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-slate-300 text-slate-600"
            }`}
          >
            考情结论
          </button>
          <button
            type="button"
            onClick={() => setTargetType("other")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
              targetType === "other"
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-slate-300 text-slate-600"
            }`}
          >
            其他信息
          </button>
        </div>
      </div>

      {targetType === "evidence" ? (
        lockedField ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">纠错字段</label>
            <div className="h-10 flex items-center px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
              {preset?.fieldLabel || fieldLabel}
            </div>
            {preset?.currentValue ? (
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">当前内容</label>
                <p className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-slate-500">
                  {preset.currentValue}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <Select
            label="纠错字段"
            placeholder="请选择考情字段"
            value={field}
            onChange={(e) => setField(e.target.value)}
            options={Object.entries(EVIDENCE_TYPE_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        )
      ) : (
        <Input
          label="纠错对象"
          placeholder="例如：某条资源链接、学习计划中的信息"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      )}

      <Textarea
        label="问题描述（必填）"
        className="min-h-[80px]"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="请描述哪里有错误、为什么认为它有误"
      />
      <Textarea
        label="认为正确的内容（选填）"
        className="min-h-[64px]"
        value={suggestedValue}
        onChange={(e) => setSuggestedValue(e.target.value)}
        placeholder="如果你已经核实了正确内容，请写在这里"
      />

      {/* 补充来源 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">
            补充来源 <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={addSource}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            + 添加一条
          </button>
        </div>
        {sources.map((source, i) => (
          <div key={i} className="rounded-lg border border-slate-200 p-2.5 space-y-2">
            <Input
              placeholder="来源链接 https://…"
              value={source.url}
              onChange={(e) => updateSource(i, { url: e.target.value })}
            />
            <Textarea
              className="min-h-[48px]"
              placeholder="或用文字说明来源（公告名称、发布单位、发布日期）"
              value={source.note}
              onChange={(e) => updateSource(i, { note: e.target.value })}
            />
            {sources.length > 1 && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => removeSource(i)}
                  className="text-xs text-slate-400 hover:text-red-500"
                >
                  移除该来源
                </button>
              </div>
            )}
          </div>
        ))}
        <p className="text-xs text-slate-400">至少提供一条来源：公告链接或文字说明均可。</p>
      </div>

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
        演示环境说明：纠错保存在本浏览器本地，提交时间自动记录；处理结果由后台
        「/admin/feedback · 纠错与治理」产生，状态变化会出现在通知中心。
      </p>

      <div className="flex justify-end gap-3 pt-1">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "提交中…" : "提交纠错"}
        </Button>
      </div>
    </div>
  );
}
