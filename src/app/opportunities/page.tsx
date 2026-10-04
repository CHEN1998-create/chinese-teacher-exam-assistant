"use client";

import { useState } from "react";
import { V61_NOW, V61_SEED_ANNOUNCEMENTS, V61_SEED_PROFILE } from "@/lib/seed/v61-opportunities";
import { buildOpportunitiesView } from "@/lib/ia/opportunities-view";
import { useV61SeedData } from "@/lib/ia/useV61SeedData";
import type { OpportunityRow } from "@/lib/ia/opportunities-view";
import { Hero } from "@/components/ia/Hero";
import { OpportunityCard } from "@/components/ia/OpportunityCard";
import { Disclosure, LayerHeading } from "@/components/ia/Layer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingPage } from "@/components/ui/Loading";

function loadView() {
  return buildOpportunitiesView(V61_SEED_ANNOUNCEMENTS, V61_SEED_PROFILE, V61_NOW);
}

const PRIORITY_ACTION_LABELS: Record<OpportunityRow["status"], string> = {
  preliminary_eligible: "查看这个机会的依据与下一步",
  need_more_info: "补充信息，判断这个机会",
  manual_review: "查看需要向招聘单位确认的条件",
  not_eligible: "查看不符合的原因",
};

export default function OpportunitiesPage() {
  const { data, loading, error, reload } = useV61SeedData(loadView);
  // 优先卡默认展开（首屏的主要行动落点）；其余卡片默认收起
  const [priorityOpen, setPriorityOpen] = useState(true);
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());

  if (loading) return <LoadingPage />;
  if (error) {
    return <ErrorState title="机会暂时加载失败" description={error} onRetry={reload} />;
  }
  if (!data) return null;

  const toggleRow = (unitId: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const focusPriority = () => {
    setPriorityOpen(true);
    document.getElementById("priority-opportunity")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  // 空数据：无任何有效机会（覆盖范围为空/全部不符合或已截止）
  if (!data.priority) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <p className="text-xs text-slate-500">{data.coverage}</p>
        <EmptyState
          title="当前还没有可以推荐的机会"
          description="完成基础画像后，新发布的官方公告会在这里按匹配程度排序；未覆盖地区不等于没有招聘。"
          actionLabel="完善我的画像"
          actionHref="/onboarding"
        />
      </div>
    );
  }

  const priority = data.priority;
  const otherPreliminary = data.preliminary.filter((row) => row.unitId !== priority.unitId);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-2">
      {/* 第一层：一句结论、一个风险、一个主按钮 */}
      <Hero
        meta={data.coverage}
        conclusion={data.conclusion}
        risk={data.risk}
        action={{
          label: PRIORITY_ACTION_LABELS[priority.status],
          onClick: focusPriority,
        }}
      />

      {/* 优先机会（第一屏内可见） */}
      <div id="priority-opportunity" className="scroll-mt-20 space-y-2">
        <LayerHeading title="优先机会" />
        <OpportunityCard
          row={priority}
          priority
          expanded={priorityOpen}
          onToggle={() => setPriorityOpen((v) => !v)}
        />
      </div>

      {/* 第二层：其他初步符合 */}
      {otherPreliminary.length > 0 && (
        <section className="space-y-3">
          <LayerHeading title="其他初步符合" count={otherPreliminary.length} />
          {otherPreliminary.map((row) => (
            <OpportunityCard
              key={row.unitId}
              row={row}
              expanded={openIds.has(row.unitId)}
              onToggle={() => toggleRow(row.unitId)}
            />
          ))}
        </section>
      )}

      {/* 第二层：补充信息后才能判断（按缺失条件分组） */}
      {data.needInfoGroups.map((group) => (
        <section key={group.dimension} className="space-y-3">
          <LayerHeading
            title={`补充${group.dimensionText}信息后判断`}
            count={group.count}
          />
          {group.rows.map((row) => (
            <OpportunityCard
              key={row.unitId}
              row={row}
              expanded={openIds.has(row.unitId)}
              onToggle={() => toggleRow(row.unitId)}
            />
          ))}
        </section>
      ))}

      {/* 第二层：建议人工确认 */}
      {data.manualReview.length > 0 && (
        <section className="space-y-3">
          <LayerHeading title="建议向招聘单位确认" count={data.manualReview.length} />
          {data.manualReview.map((row) => (
            <OpportunityCard
              key={row.unitId}
              row={row}
              expanded={openIds.has(row.unitId)}
              onToggle={() => toggleRow(row.unitId)}
            />
          ))}
        </section>
      )}

      {/* 二级分组：明确不符合 / 已截止，默认收起，原因可查 */}
      {data.notEligible.length > 0 && (
        <Disclosure title="明确不符合" count={data.notEligible.length}>
          <div className="space-y-3">
            {data.notEligible.map((row) => (
              <OpportunityCard
                key={row.unitId}
                row={row}
                expanded={openIds.has(row.unitId)}
                onToggle={() => toggleRow(row.unitId)}
              />
            ))}
          </div>
        </Disclosure>
      )}

      {data.closed.length > 0 && (
        <Disclosure title="已截止或不在收录范围" count={data.closed.length}>
          <div className="space-y-3">
            {data.closed.map((row) => (
              <OpportunityCard
                key={row.unitId}
                row={row}
                expanded={openIds.has(row.unitId)}
                onToggle={() => toggleRow(row.unitId)}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            已截止机会不进入推荐；公告撤回或字段更正会保留版本记录，可在详情中追溯。
          </p>
        </Disclosure>
      )}
    </div>
  );
}
