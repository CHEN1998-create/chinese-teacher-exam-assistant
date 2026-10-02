"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Correction, CORRECTION_TIMELINE_ACTION_LABELS } from "@/types";
import { useMyCorrections } from "@/lib/governance/useGovernance";
import { correctionService } from "@/lib/governance/correctionService";
import { CorrectionStatusBadge } from "./badges";
import { formatDateTime } from "@/lib/utils";

/**
 * 我的纠错：提交时间、处理状态、处理结果、补充材料与完整时间线。
 * 数据来自 useMyCorrections（service 层已按当前用户过滤）。
 */
export function MyCorrections({
  onNewCorrection,
}: {
  onNewCorrection: () => void;
}) {
  const corrections = useMyCorrections();

  return (
    <Card>
      <CardHeader
        title="我的纠错"
        description="提交后可在此跟踪处理状态与结果；审核员要求补充时可直接补充材料"
        action={
          <Button size="sm" variant="outline" onClick={onNewCorrection}>
            新增纠错
          </Button>
        }
      />
      {corrections.length === 0 ? (
        <p className="text-sm text-slate-500">
          还没有提交过纠错。发现考情结论有误时，可在「这次考试怎么考」的字段上点击「提交纠错」。
        </p>
      ) : (
        <ul className="space-y-3">
          {corrections.map((c) => (
            <CorrectionItem key={c.id} correction={c} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function CorrectionItem({ correction }: { correction: Correction }) {
  const [showTimeline, setShowTimeline] = useState(false);
  const needInfo = correction.status === "need_info";

  return (
    <li className="rounded-lg border border-slate-200 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">
            {correction.targetType === "evidence" ? "考情结论 · " : "其他信息 · "}
            {correction.subject}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            提交于 {formatDateTime(correction.createdAt)}
          </p>
        </div>
        <CorrectionStatusBadge status={correction.status} />
      </div>

      {correction.currentValue && (
        <p className="mt-2 text-xs text-slate-500">
          <span className="text-slate-400">当前内容：</span>
          {correction.currentValue}
        </p>
      )}
      <p className="mt-1 text-sm text-slate-700">
        <span className="text-slate-400 text-xs">问题描述：</span>
        {correction.description}
      </p>
      {correction.suggestedValue && (
        <p className="mt-1 text-sm text-slate-700">
          <span className="text-slate-400 text-xs">正确内容：</span>
          {correction.suggestedValue}
        </p>
      )}

      {correction.sources.length > 0 && (
        <div className="mt-2 space-y-1">
          {correction.sources.map((s) => (
            <p key={s.id} className="text-xs text-slate-500">
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  来源链接 ↗ {s.note ? `（${s.note}）` : ""}
                </a>
              ) : (
                <span>来源说明：{s.note}</span>
              )}
            </p>
          ))}
        </div>
      )}

      {/* 处理结果 / 待补充提示 */}
      {correction.resultNote && (
        <div
          className={`mt-2.5 rounded-lg px-3 py-2 text-xs leading-relaxed ${
            needInfo
              ? "bg-amber-50 border border-amber-200 text-amber-800"
              : correction.status === "rejected"
                ? "bg-slate-50 border border-slate-200 text-slate-600"
                : "bg-emerald-50 border border-emerald-200 text-emerald-800"
          }`}
        >
          <span className="font-medium">
            {needInfo
              ? "审核员需要你补充："
              : correction.status === "rejected"
                ? "未采纳原因："
                : "处理结果："}
          </span>
          {correction.resultNote}
          {correction.appliedToEvidence && (
            <span className="block mt-1">关联考情结论已同步更新（人工审核留痕可查）。</span>
          )}
        </div>
      )}

      {needInfo && <SupplementForm correctionId={correction.id} />}

      <button
        type="button"
        onClick={() => setShowTimeline((v) => !v)}
        className="mt-2 text-xs text-slate-400 hover:text-slate-600"
      >
        {showTimeline ? "收起处理记录" : "查看处理记录"}
      </button>
      {showTimeline && (
        <ol className="mt-2 space-y-2 border-l-2 border-slate-100 pl-3">
          {correction.timeline.map((entry) => (
            <li key={entry.id} className="text-xs">
              <p className="font-medium text-slate-700">
                {CORRECTION_TIMELINE_ACTION_LABELS[entry.action]}
                <span className="ml-2 font-normal text-slate-400">
                  {entry.actorName} · {formatDateTime(entry.at)}
                </span>
              </p>
              {entry.note && <p className="mt-0.5 text-slate-500">{entry.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

function SupplementForm({ correctionId }: { correctionId: string }) {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = () => {
    setError(null);
    try {
      correctionService.supplement(correctionId, { url, note });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "补充失败，请重试");
    }
  };

  if (done) {
    return (
      <div className="mt-2.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
        补充材料已提交，纠错重新进入处理队列。
      </div>
    );
  }

  return (
    <div className="mt-2.5 space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
      <Input
        placeholder="补充来源链接 https://…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <Textarea
        className="min-h-[56px]"
        placeholder="补充文字说明（公告名称、发布单位、日期等）"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="text-right">
        <Button size="sm" onClick={submit}>
          提交补充材料
        </Button>
      </div>
    </div>
  );
}
