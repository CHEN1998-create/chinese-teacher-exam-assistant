"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { Input, Textarea } from "@/components/ui/Input";
import { TargetForm } from "@/components/targets/TargetForm";
import { ClarificationPanel } from "@/components/targets/ClarificationPanel";
import { EvidenceProfile } from "@/components/evidence/EvidenceProfile";
import { AnnouncementSubmitForm } from "@/components/evidence/AnnouncementSubmitForm";
import { ExtractionJobPanel } from "@/components/evidence/ExtractionJobPanel";
import { examTargetService, evidenceService } from "@/lib/services";
import { canEnterVerification } from "@/lib/targets/domain";
import { useExamTargets } from "@/lib/targets/useCurrentExamTarget";
import { useEvidence } from "@/lib/evidence/useEvidence";
import {
  AnnouncementSourceInput,
  Correction,
  EVIDENCE_TYPE_LABELS,
  EDUCATION_LEVEL_LABELS,
  EXAM_TYPE_LABELS,
  EXAM_STAGE_LABELS,
  EvidenceItem,
  EvidenceType,
  ExamTarget,
  ExamTargetInput,
  SUBJECT_LABELS,
  TARGET_LIFECYCLE_LABELS,
  TARGET_STATUS_LABELS,
} from "@/types";

const tabs = [
  { id: "profile", label: "考情画像" },
  { id: "submit", label: "提交公告" },
  { id: "pending", label: "待确认与纠错" },
];

function displayValue(value: string | undefined): string {
  return value && value.trim() ? value : "待确认";
}

export default function ExamPage() {
  // 订阅式读取：切换/编辑/归档/任务勾选后自动刷新
  const { targets: allTargets, current: currentExam } = useExamTargets();
  const [activeTab, setActiveTab] = useState("profile");
  const [showHistory, setShowHistory] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<ExamTarget | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [archivingTarget, setArchivingTarget] = useState<ExamTarget | null>(null);

  // 纠错弹窗
  const [correcting, setCorrecting] = useState<{
    field: string;
    fieldLabel: string;
    currentValue: string;
  } | null>(null);
  const [correctionSuggested, setCorrectionSuggested] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionSourceUrl, setCorrectionSourceUrl] = useState("");
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [lastCorrectionAt, setLastCorrectionAt] = useState<string | null>(null);

  const historyTargets = allTargets.filter((t) => t.id !== currentExam?.id);
  const evidence = useEvidence(currentExam);
  const busy = evidence.latestJob?.status === "processing";

  const pendingRows = evidence.rows.filter(
    (r) => r.reviewStatus === "unconfirmed" || r.hasConflict
  );

  const runAction = (fn: () => void) => {
    setActionError(null);
    try {
      fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "操作失败，请重试");
    }
  };

  const handleEditSubmit = (input: ExamTargetInput) => {
    if (!editingTarget) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      examTargetService.update(editingTarget.id, input);
      setEditingTarget(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "保存失败，请稍后重试");
    } finally {
      setEditSubmitting(false);
    }
  };

  /** 提交公告来源（失败由表单展示，进行中/成功由任务面板展示） */
  const handleSubmitAnnouncement = async (input: AnnouncementSourceInput) => {
    if (!currentExam) return;
    await evidenceService.startExtraction(currentExam.id, input);
  };

  const handleRetryJob = async (jobId: string) => {
    setActionError(null);
    try {
      await evidenceService.retryJob(jobId);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "重新提取失败，请重试");
    }
  };

  const openCorrection = (item?: EvidenceItem) => {
    if (!item) {
      setCorrecting({ field: "", fieldLabel: "", currentValue: "" });
    } else {
      setCorrecting({
        field: item.field,
        fieldLabel: EVIDENCE_TYPE_LABELS[item.field as EvidenceType] ?? "",
        currentValue: item.value,
      });
    }
    setCorrectionSuggested("");
    setCorrectionReason("");
    setCorrectionSourceUrl("");
    setCorrectionError(null);
  };

  const handleSubmitCorrection = () => {
    if (!currentExam || !correcting) return;
    setCorrectionError(null);
    try {
      evidenceService.submitCorrection({
        targetId: currentExam.id,
        field: correcting.field,
        fieldLabel: correcting.fieldLabel,
        currentValue: correcting.currentValue || "（缺失字段）",
        suggestedValue: correctionSuggested,
        reason: correctionReason,
        sourceUrl: correctionSourceUrl,
      });
      setCorrecting(null);
      setLastCorrectionAt(new Date().toLocaleString("zh-CN", { hour12: false }));
    } catch (e) {
      setCorrectionError(e instanceof Error ? e.message : "提交失败，请重试");
    }
  };

  // ========== 首次进入：没有任何目标 ==========
  if (!currentExam) {
    const hasDrafts = allTargets.length > 0;
    return (
      <div className="space-y-6">
        {hasDrafts && (
          <TargetHistoryList
            targets={allTargets}
            onSwitch={(t) => runAction(() => examTargetService.setCurrent(t.id))}
            onEdit={(t) => setEditingTarget(t)}
            onArchive={(t) => setArchivingTarget(t)}
            onRestore={(t) => runAction(() => examTargetService.restore(t.id))}
            defaultOpen
          />
        )}
        <EmptyState
          icon={<span className="text-5xl">🧭</span>}
          title={hasDrafts ? "还没有当前主目标" : "先明确你正在准备哪一次考试"}
          description={
            hasDrafts
              ? "从历史目标中选择一个设为当前，或重新进行目标澄清"
              : "信息不足时只会生成澄清任务，不会直接生成看似精确的学习计划"
          }
          actionLabel="开始目标澄清"
          actionHref="/onboarding"
        />
        {renderEditModal()}
        {renderArchiveModal()}
      </div>
    );
  }

  const isReady = canEnterVerification(currentExam);

  return (
    <div className="space-y-6">
      {actionError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          ⚠️ {actionError}
        </div>
      )}
      {lastCorrectionAt && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 flex items-center justify-between gap-3">
          <span>✅ 纠错已提交（{lastCorrectionAt}），可在“待确认与纠错”中查看处理状态。</span>
          <button
            type="button"
            className="text-emerald-600 hover:text-emerald-800 text-xs shrink-0"
            onClick={() => setLastCorrectionAt(null)}
          >
            知道了
          </button>
        </div>
      )}

      {/* 顶部操作 */}
      <div className="flex items-center justify-between">
        <Link
          href="/onboarding"
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          + 新增目标
        </Link>
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          {showHistory ? "收起历史目标" : `历史目标（${historyTargets.length}）`}
        </button>
      </div>
      {showHistory && (
        <TargetHistoryList
          targets={historyTargets}
          onSwitch={(t) => runAction(() => examTargetService.setCurrent(t.id))}
          onEdit={(t) => setEditingTarget(t)}
          onArchive={(t) => setArchivingTarget(t)}
          onRestore={(t) => runAction(() => examTargetService.restore(t.id))}
        />
      )}

      {/* 当前目标概览 */}
      <Card>
        <CardHeader
          title={currentExam.name}
          action={
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant={isReady ? "success" : "warning"}>
                {TARGET_LIFECYCLE_LABELS[currentExam.status]}
              </Badge>
              <Badge variant="muted">{TARGET_STATUS_LABELS[currentExam.targetStatus]}</Badge>
            </span>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <InfoItem label="省份" value={displayValue(currentExam.province)} />
          <InfoItem
            label="城市/招聘单位"
            value={displayValue(currentExam.city || currentExam.recruiter)}
          />
          <InfoItem
            label="招聘类型"
            value={currentExam.examType ? EXAM_TYPE_LABELS[currentExam.examType] : "待确认"}
          />
          <InfoItem
            label="年份/批次"
            value={
              [
                currentExam.year ? `${currentExam.year}年` : null,
                currentExam.batch ?? null,
              ]
                .filter(Boolean)
                .join(" · ") || "待确认"
            }
          />
          <InfoItem
            label="学段"
            value={currentExam.educationLevel ? EDUCATION_LEVEL_LABELS[currentExam.educationLevel] : "待确认"}
          />
          <InfoItem label="学科" value={SUBJECT_LABELS[currentExam.subject]} />
          <InfoItem label="考试阶段" value={EXAM_STAGE_LABELS[currentExam.stage]} />
          <InfoItem label="目标状态" value={TARGET_STATUS_LABELS[currentExam.targetStatus]} />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={() => setEditingTarget(currentExam)}>
            编辑目标
          </Button>
          <Button variant="outline" size="sm" onClick={() => setArchivingTarget(currentExam)}>
            归档目标
          </Button>
          {isReady && (
            <Button size="sm" onClick={() => setActiveTab("profile")}>
              进入考情核验
            </Button>
          )}
        </div>
      </Card>

      {/* 信息不足：只显示澄清任务，不显示精确计划/考情 */}
      {!isReady && (
        <ClarificationPanel
          target={currentExam}
          onEdit={() => setEditingTarget(currentExam)}
        />
      )}

      {/* 已确认：公告提交与考情证据 */}
      {isReady && (
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab}>
          <TabPanel id="profile" activeTab={activeTab}>
            <EvidenceProfile
              rows={evidence.rows}
              counts={evidence.counts}
              onCorrect={(item) => openCorrection(item)}
            />
          </TabPanel>

          <TabPanel id="submit" activeTab={activeTab}>
            <div className="space-y-4">
              <AnnouncementSubmitForm
                target={currentExam}
                busy={busy}
                onSubmit={handleSubmitAnnouncement}
              />
              <ExtractionJobPanel
                job={evidence.latestJob}
                history={evidence.jobs.slice(1)}
                busy={busy}
                onRetry={handleRetryJob}
              />
              <Card className="bg-slate-50/60">
                <p className="text-xs text-slate-500 leading-relaxed">
                  说明：当前为无后端演示环境，文本提取使用浏览器本地规则识别；链接来源不会真实访问网页，
                  结果按目标信息模拟生成并标注“模拟提取”。提取结论只会是“AI已提取”或“待审核”，
                  “官方确认”仅来自运营审核后台（/admin，可用考情审核员演示账号登录）的人工审核，
                  审核后的状态、驳回与来源冲突会同步显示在本页证据卡中。
                </p>
              </Card>
            </div>
          </TabPanel>

          <TabPanel id="pending" activeTab={activeTab}>
            <div className="space-y-4">
              <Card>
                <CardHeader
                  title={`待确认字段（${pendingRows.length}）`}
                  description="没有来源、来源冲突或尚未提取到的字段统一显示为待确认"
                  action={
                    <Button size="sm" onClick={() => setActiveTab("submit")}>
                      去提交公告
                    </Button>
                  }
                />
                {pendingRows.length > 0 ? (
                  <ul className="space-y-2">
                    {pendingRows.map((row) => (
                      <li
                        key={row.field}
                        className={`rounded-lg border px-3 py-2 ${
                          row.hasConflict ? "border-red-200 bg-red-50/50" : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800">
                              {EVIDENCE_TYPE_LABELS[row.field]}
                              {row.hasConflict && (
                                <span className="ml-2 text-xs text-red-600">来源冲突</span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {row.value ? row.value : "尚未从任何来源提取到该信息"}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openCorrection(row)}
                          >
                            提交纠错
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">暂无待确认字段。</p>
                )}
              </Card>

              <Card>
                <CardHeader
                  title="我的纠错"
                  description="纠错提交后进入人工处理队列（演示环境仅持久化为“待处理”）"
                  action={
                    <Button size="sm" variant="outline" onClick={() => openCorrection()}>
                      新增纠错
                    </Button>
                  }
                />
                {evidence.corrections.length > 0 ? (
                  <ul className="space-y-2">
                    {evidence.corrections.map((c) => (
                      <CorrectionRecord key={c.id} correction={c} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">还没有提交过纠错。</p>
                )}
              </Card>
            </div>
          </TabPanel>
        </Tabs>
      )}

      {/* 编辑弹窗 */}
      {renderEditModal()}
      {renderArchiveModal()}

      {/* 纠错弹窗 */}
      <Modal
        isOpen={!!correcting}
        onClose={() => setCorrecting(null)}
        title="提交考情纠错"
        footer={
          <>
            <Button variant="outline" onClick={() => setCorrecting(null)}>
              取消
            </Button>
            <Button onClick={handleSubmitCorrection}>提交纠错</Button>
          </>
        }
      >
        <div className="space-y-4">
          {correctionError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              ⚠️ {correctionError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">纠错字段</label>
            {correcting?.field ? (
              <input
                value={correcting.fieldLabel}
                disabled
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600"
              />
            ) : (
              <select
                value={correcting?.field ?? ""}
                onChange={(e) =>
                  setCorrecting((prev) =>
                    prev ? { ...prev, field: e.target.value, fieldLabel: EVIDENCE_TYPE_LABELS[e.target.value as EvidenceType] ?? e.target.value } : prev
                  )
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm"
              >
                <option value="" disabled>
                  请选择字段
                </option>
                {Object.entries(EVIDENCE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">当前内容</label>
            <p className="min-h-[40px] rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-500">
              {correcting?.currentValue || "（该字段缺失，当前为待确认）"}
            </p>
          </div>
          <Textarea
            label="你认为正确的内容"
            className="min-h-[72px]"
            value={correctionSuggested}
            onChange={(e) => setCorrectionSuggested(e.target.value)}
            placeholder="请填写正确信息"
          />
          <Textarea
            label="纠错原因或信息来源"
            className="min-h-[72px]"
            value={correctionReason}
            onChange={(e) => setCorrectionReason(e.target.value)}
            placeholder="例如：已对照官网最新公告，附链接"
          />
          <Input
            label="佐证链接（选填）"
            placeholder="https://..."
            value={correctionSourceUrl}
            onChange={(e) => setCorrectionSourceUrl(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );

  function renderEditModal() {
    return (
      <Modal
        isOpen={!!editingTarget}
        onClose={() => {
          setEditingTarget(null);
          setEditError(null);
        }}
        title="编辑目标信息"
      >
        {editingTarget && (
          <TargetForm
            mode="edit"
            initial={examTargetService.toInput(editingTarget)}
            submitting={editSubmitting}
            errorMessage={editError}
            onSubmit={handleEditSubmit}
            onCancel={() => {
              setEditingTarget(null);
              setEditError(null);
            }}
          />
        )}
      </Modal>
    );
  }

  function renderArchiveModal() {
    return (
      <ConfirmModal
        isOpen={!!archivingTarget}
        onClose={() => setArchivingTarget(null)}
        onConfirm={() => {
          if (archivingTarget) runAction(() => examTargetService.archive(archivingTarget.id));
          setArchivingTarget(null);
        }}
        title="归档目标"
        description={`归档后「${archivingTarget?.name ?? ""}」将不再作为备考目标，历史资料仍会保留。可在历史目标中重新启用。`}
        confirmLabel="确认归档"
        variant="danger"
      />
    );
  }
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-slate-50 rounded-lg">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}

// ==================== 纠错记录 ====================

function CorrectionRecord({ correction }: { correction: Correction }) {
  return (
    <li className="rounded-lg border border-slate-200 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-800">
          {correction.fieldLabel || correction.field}
        </p>
        <Badge variant="warning">待处理</Badge>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        建议：{correction.suggestedValue}
      </p>
      <p className="mt-0.5 text-xs text-slate-400">原因：{correction.reason}</p>
      {correction.sourceUrl && (
        <a
          href={correction.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-xs text-blue-600 hover:underline"
        >
          查看佐证链接 ↗
        </a>
      )}
      <p className="mt-0.5 text-[11px] text-slate-400">
        提交于 {new Date(correction.createdAt).toLocaleString("zh-CN", { hour12: false })}
      </p>
    </li>
  );
}

// ==================== 历史目标列表 ====================

function TargetHistoryList({
  targets,
  onSwitch,
  onEdit,
  onArchive,
  onRestore,
  defaultOpen = false,
}: {
  targets: ExamTarget[];
  onSwitch: (t: ExamTarget) => void;
  onEdit: (t: ExamTarget) => void;
  onArchive: (t: ExamTarget) => void;
  onRestore: (t: ExamTarget) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (targets.length === 0) return null;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-sm font-medium text-slate-900">
          全部目标（{targets.length}）
        </span>
        <span className="text-xs text-slate-400">{open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2.5">
          {targets.map((t) => {
            const archived = t.status === "archived";
            return (
              <div
                key={t.id}
                className={`rounded-xl border p-3 ${
                  archived ? "border-slate-200 bg-slate-50/60 opacity-80" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{t.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {[
                        t.region,
                        t.educationLevel ? EDUCATION_LEVEL_LABELS[t.educationLevel] : null,
                        t.year ? `${t.year}年` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "信息待补充"}
                    </p>
                    <span className="mt-1.5 inline-flex">
                      <Badge variant={archived ? "muted" : t.status === "confirmed" ? "success" : "warning"}>
                        {TARGET_LIFECYCLE_LABELS[t.status]}
                      </Badge>
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {!archived ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => onSwitch(t)}>
                          设为当前
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onEdit(t)}>
                          编辑
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => onArchive(t)}>
                          归档
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => onRestore(t)}>
                        重新启用
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
