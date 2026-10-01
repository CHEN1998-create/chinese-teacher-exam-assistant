"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EvidenceBadge } from "@/components/ui/Badge";
import { EvidenceCardItem } from "@/components/ui/EvidenceCardItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingPage } from "@/components/ui/Loading";
import { Modal } from "@/components/ui/Modal";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { examTargetService, evidenceService } from "@/lib/services";
import { EDUCATION_LEVEL_LABELS, EXAM_TYPE_LABELS, EXAM_STAGE_LABELS } from "@/types";

const tabs = [
  { id: "info", label: "考试信息" },
  { id: "evidence", label: "证据卡" },
  { id: "pending", label: "待确认" },
];

export default function ExamPage() {
  const [activeTab, setActiveTab] = useState("info");
  const [isLoading] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionField, setCorrectionField] = useState("");
  const [correctionValue, setCorrectionValue] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");

  const currentExam = examTargetService.getCurrent();

  const evidenceCards = useMemo(() => {
    if (!currentExam) return [];
    return evidenceService.getByExamTargetId(currentExam.id);
  }, [currentExam]);

  const confirmedCards = useMemo(() => {
    return evidenceCards.filter((e) => e.level === "official");
  }, [evidenceCards]);

  const pendingCards = useMemo(() => {
    return evidenceCards.filter((e) => e.level === "pending");
  }, [evidenceCards]);

  if (isLoading) return <LoadingPage />;

  if (!currentExam) {
    return (
      <EmptyState
        title="还没有设置考试目标"
        description="先完成目标澄清，才能查看考试信息"
        actionLabel="设置目标"
        actionHref="/onboarding"
      />
    );
  }

  const handleSubmitCorrection = () => {
    // 模拟提交纠错
    setIsCorrectionModalOpen(false);
    setCorrectionField("");
    setCorrectionValue("");
    setCorrectionReason("");
  };

  return (
    <div className="space-y-6">
      {/* 考试概览 */}
      <Card>
        <CardHeader
          title={currentExam.name}
          action={<EvidenceBadge level="official" />}
        />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <InfoItem label="地区" value={currentExam.region} />
          <InfoItem label="学段" value={EDUCATION_LEVEL_LABELS[currentExam.educationLevel]} />
          <InfoItem label="招聘类型" value={EXAM_TYPE_LABELS[currentExam.examType]} />
          <InfoItem label="年份" value={`${currentExam.year}年`} />
          <InfoItem label="批次" value={currentExam.batch || "待确认"} />
          <InfoItem label="当前阶段" value={EXAM_STAGE_LABELS[currentExam.stage]} />
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
      </Card>

      {/* 证据与待确认 */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab}>
        <TabPanel id="info" activeTab={activeTab}>
          <div className="space-y-4">
            {/* 已确认信息 */}
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
                  description="考情正在审核中，稍后再来看"
                />
              )}
            </div>

            {/* 待确认信息 */}
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
                <EmptyState
                  title="暂无待确认信息"
                  description="所有考情均已确认"
                />
              )}
            </div>
          </div>
        </TabPanel>

        <TabPanel id="evidence" activeTab={activeTab}>
          <div className="space-y-3">
            {evidenceCards.map((card) => (
              <EvidenceCardItem key={card.id} card={card} />
            ))}
          </div>
        </TabPanel>

        <TabPanel id="pending" activeTab={activeTab}>
          <div className="space-y-3">
            {pendingCards.length > 0 ? (
              pendingCards.map((card) => (
                <EvidenceCardItem key={card.id} card={card} />
              ))
            ) : (
              <EmptyState
                title="没有待确认信息"
                description="所有考情均已通过审核"
              />
            )}
          </div>
        </TabPanel>
      </Tabs>

      {/* 纠错入口 */}
      <Card>
        <CardHeader
          title="发现信息有误？"
          description="如果你对考情信息有疑问，可以提交纠错"
        />
        <Button
          variant="outline"
          onClick={() => setIsCorrectionModalOpen(true)}
        >
          提交纠错
        </Button>
      </Card>

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
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-slate-50 rounded-lg">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}
