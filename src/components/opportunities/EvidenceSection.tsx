"use client";

import { Button } from "@/components/ui/Button";
import { Disclosure } from "@/components/ia/Layer";
import { dimensionLabel } from "@/lib/ia/labels";
import type { UnitDetailResponse } from "@/lib/opportunities/api-types";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const SOURCE_KIND_LABELS: Record<string, string> = {
  original: "原始公告",
  supplement: "补充公告",
  correction: "更正公告",
};

function EvidenceLink({ url }: { url?: string }) {
  if (!url) return <span className="text-slate-400">无链接</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all text-blue-700 underline underline-offset-2"
    >
      打开官方原文（新窗口）
    </a>
  );
}

/**
 * 详情第三层：官方原文锚点、逐条件证据、版本链、规则版本与纠错入口。
 * 每个结论都能在此追溯到公告版本 + 证据 + 评估所用规则版本。
 */
export function EvidenceSection({
  detail,
  onOpenCorrection,
}: {
  detail: UnitDetailResponse;
  onOpenCorrection: () => void;
}) {
  const { unit, previousVersions, meta } = detail;
  const evidences = unit.dimensions.filter((d) => d.evidence);
  const source = unit.version.officialSource;

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              官方依据与版本
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              当前依据：
              {SOURCE_KIND_LABELS[unit.version.sourceKind] ??
                unit.version.sourceKind}{" "}
              v{unit.version.versionNumber} ·{" "}
              {formatDateTime(unit.version.publishedAt)} 发布 ·{" "}
              {unit.announcement.publisher}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={onOpenCorrection}>
            提交纠错
          </Button>
        </div>

        {unit.version.changeNote && (
          <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
            版本说明：{unit.version.changeNote}
          </p>
        )}

        <dl className="mt-3 space-y-2 text-xs text-slate-600">
          <div>
            <dt className="font-medium text-slate-500">官方来源</dt>
            <dd className="mt-0.5">
              <EvidenceLink url={source.locator.url} />
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-slate-500">核对状态</dt>
            <dd>
              {source.state === "official"
                ? "已与官方公告核对"
                : "待人工核对（不作为正式依据）"}
              ，核对时间 {formatDateTime(source.checkedAt)}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-slate-500">复核状态</dt>
            <dd>
              {unit.announcement.reviewStatus === "human_reviewed"
                ? "已人工复核"
                : "AI 初核 · 待人工复核（不作为正式推荐依据）"}
              {unit.announcement.reviewedBy
                ? ` · 复核人 ${unit.announcement.reviewedBy}`
                : ""}
              {unit.announcement.reviewedAt
                ? ` · 复核于 ${formatDateTime(unit.announcement.reviewedAt)}`
                : ""}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-slate-500">报名时间</dt>
            <dd>
              {unit.version.timeline.registrationStart &&
              unit.version.timeline.registrationEnd
                ? `${unit.version.timeline.registrationStart} 至 ${unit.version.timeline.registrationEnd}`
                : "官方尚未公布具体报名时间，以官方后续通知为准"}
            </dd>
          </div>
          {unit.version.timeline.writtenExamDate && (
            <div className="flex gap-2">
              <dt className="shrink-0 font-medium text-slate-500">笔试时间</dt>
              <dd>{unit.version.timeline.writtenExamDate}</dd>
            </div>
          )}
          {unit.version.timeline.pendingItems?.map((item) => (
            <div key={item} className="text-slate-500">
              待官方明确：{item}
            </div>
          ))}
        </dl>

        {unit.unit.sourceRow && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">
              岗位表位置（行级锚点）
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {unit.unit.sourceRow.locator.anchor ??
                unit.unit.sourceRow.locator.sheet ??
                "官方岗位表附件"}
            </p>
            {unit.unit.sourceRow.excerpt && (
              <p className="mt-1 border-l-2 border-slate-200 pl-2 text-xs text-slate-500">
                “{unit.unit.sourceRow.excerpt}”
              </p>
            )}
            <p className="mt-1.5 text-[11px] text-slate-400">
              <EvidenceLink url={unit.unit.sourceRow.locator.url} /> ·{" "}
              {unit.unit.sourceRow.state === "official"
                ? "已核对"
                : "AI 初核待人工核对"}{" "}
              · {formatDateTime(unit.unit.sourceRow.checkedAt)}
            </p>
          </div>
        )}
      </div>

      <Disclosure title="逐项条件的原文证据" count={evidences.length}>
        <ul className="space-y-3">
          {evidences.map((dim) => (
            <li
              key={dim.requirementId}
              className="rounded-lg border border-slate-100 p-3"
            >
              <p className="text-xs font-semibold text-slate-700">
                {dimensionLabel(dim.dimension)}
                {dim.requirementDescription
                  ? `：${dim.requirementDescription}`
                  : ""}
              </p>
              {dim.evidence?.excerpt && (
                <p className="mt-1 border-l-2 border-slate-200 pl-2 text-xs text-slate-500">
                  “{dim.evidence.excerpt}”
                </p>
              )}
              <p className="mt-1.5 text-[11px] text-slate-400">
                <EvidenceLink url={dim.evidence?.locator.url} /> ·{" "}
                {dim.evidence ? formatDateTime(dim.evidence.checkedAt) : ""}
              </p>
            </li>
          ))}
        </ul>
      </Disclosure>

      {previousVersions.length > 0 && (
        <Disclosure title="历史版本" count={previousVersions.length}>
          <ul className="space-y-2 text-xs text-slate-500">
            {previousVersions.map((v) => (
              <li key={v.id} className="rounded-lg bg-slate-50 p-2.5">
                <p>
                  {SOURCE_KIND_LABELS[v.sourceKind] ?? v.sourceKind} v
                  {v.versionNumber} · {formatDateTime(v.publishedAt)}
                  {v.supersededAt && (
                    <span className="ml-2 text-slate-400">
                      已于 {formatDateTime(v.supersededAt)} 被新版本取代
                    </span>
                  )}
                </p>
                {v.changeNote && (
                  <p className="mt-1 text-slate-500">说明：{v.changeNote}</p>
                )}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
        本结论由规则版本 {meta.ruleVersion}、专业别名表{" "}
        {meta.majorAliasVersion}、公告目录 {meta.catalogVersion} 与真实监测台账{" "}
        {meta.realCatalogVersion} 于 {formatDateTime(meta.evaluatedAt)} 计算；
        公告更新或你修改画像后会重新计算。资格初审结果以招聘单位审核为准。
      </p>
    </section>
  );
}
