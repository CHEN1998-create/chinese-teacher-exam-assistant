"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, EvidenceBadge } from "@/components/ui/Badge";
import { EvidenceCardItem } from "@/components/ui/EvidenceCardItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { TargetForm } from "@/components/targets/TargetForm";
import { ClarificationPanel } from "@/components/targets/ClarificationPanel";
import { examTargetService, evidenceService } from "@/lib/services";
import { canEnterVerification } from "@/lib/targets/domain";
import { useExamTargets } from "@/lib/targets/useCurrentExamTarget";
import {
  ExamTarget,
  ExamTargetInput,
  EDUCATION_LEVEL_LABELS,
  EXAM_TYPE_LABELS,
  EXAM_STAGE_LABELS,
  SUBJECT_LABELS,
  TARGET_LIFECYCLE_LABELS,
  TARGET_STATUS_LABELS,
} from "@/types";

const tabs = [
  { id: "info", label: "考试信息" },
  { id: "evidence", label: "证据卡" },
  { id: "pending", label: "待确认" },
];

function displayValue(value: string | undefined): string {
  return value && value.trim() ? value : "待确认";
}

export default function ExamPage() {
  // 订阅式读取：切换/编辑/归档/任务勾选后自动刷新
  const { targets: allTargets, current: currentExam } = useExamTargets();
  const [activeTab, setActiveTab] = useState("info");
  const [showHistory, setShowHistory] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<ExamTarget | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [archivingTarget, setArchivingTarget] = useState<ExamTarget | null>(null);

  // 纠错弹窗（原有功能）
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionField, setCorrectionField] = useState("");
  const [correctionValue, setCorrectionValue] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");

  const historyTargets = allTargets.filter((t) => t.id !== currentExam?.id);

  const evidenceCards = useMemo(() => {
    if (!currentExam) return [];
    return evidenceService.getByExamTargetId(currentExam.id);
  }, [currentExam]);
  const confirmedCards = evidenceCards.filter((e) => e.level === "official");
  const pendingCards = evidenceCards.filter((e) => e.level === "pending");

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

  const handleSubmitCorrection = () => {
    setIsCorrectionModalOpen(false);
    setCorrectionField("");
    setCorrectionValue("");
    setCorrectionReason("");
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
              {isReady && <EvidenceBadge level="official" />}
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

        {currentExam.announcementUrl && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <a
              href={currentExam.announcementUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              查看官方公告
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={() => setEditingTarget(currentExam)}>
            编辑目标
          </Button>
          <Button variant="outline" size="sm" onClick={() => setArchivingTarget(currentExam)}>
            归档目标
          </Button>
          {isReady && (
            <Button size="sm" onClick={() => setActiveTab("pending")}>
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

      {/* 已确认：考情核验区（证据卡/待确认/纠错，沿用原有功能） */}
      {isReady && (
        <>
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab}>
            <TabPanel id="info" activeTab={activeTab}>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">
                    已确认信息（{confirmedCards.length}条）
                  </h3>
                  {confirmedCards.length > 0 ? (
                    <div className="space-y-3">
                      {confirmedCards.map((card) => (
                        <EvidenceCardItem key={card.id} card={card} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="暂无已确认信息"
                      description="目标已确认，考情核验将在后续流程中填充官方证据"
                    />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">
                    待确认信息（{pendingCards.length}条）
                  </h3>
                  {pendingCards.length > 0 ? (
                    <div className="space-y-3">
                      {pendingCards.map((card) => (
                        <EvidenceCardItem key={card.id} card={card} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="暂无待确认信息" description="所有考情均已确认" />
                  )}
                </div>
              </div>
            </TabPanel>

            <TabPanel id="evidence" activeTab={activeTab}>
              <div className="space-y-3">
                {evidenceCards.length > 0 ? (
                  evidenceCards.map((card) => <EvidenceCardItem key={card.id} card={card} />)
                ) : (
                  <EmptyState title="暂无证据卡" description="考情核验后会在这里展示证据" />
                )}
              </div>
            </TabPanel>

            <TabPanel id="pending" activeTab={activeTab}>
              <div className="space-y-3">
                <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                  考情核验：逐条核对下方信息的来源与可信度。公告解析与人工审核将在后续版本提供。
                </div>
                {pendingCards.length > 0 ? (
                  pendingCards.map((card) => <EvidenceCardItem key={card.id} card={card} />)
                ) : (
                  <EmptyState title="没有待确认信息" description="所有考情均已通过审核" />
                )}
              </div>
            </TabPanel>
          </Tabs>

          <Card>
            <CardHeader title="发现信息有误？" description="如果你对考情信息有疑问，可以提交纠错" />
            <Button variant="outline" onClick={() => setIsCorrectionModalOpen(true)}>
              提交纠错
            </Button>
          </Card>
        </>
      )}

      {/* 编辑弹窗 */}
      {renderEditModal()}
      {renderArchiveModal()}

      {/* 纠错弹窗 */}
      <Modal
        isOpen={isCorrectionModalOpen}
        onClose={() => setIsCorrectionModalOpen(false)}
        title="提交纠错"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsCorrectionModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmitCorrection}>提交</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">字段</label>
            <input
              type="text"
              value={correctionField}
              onChange={(e) => setCorrectionField(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例如：笔试科目"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">正确内容</label>
            <textarea
              value={correctionValue}
              onChange={(e) => setCorrectionValue(e.target.value)}
              className="w-full min-h-[80px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请提供你认为正确的信息"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">纠错原因</label>
            <textarea
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              className="w-full min-h-[80px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请说明你的信息来源"
            />
          </div>
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
