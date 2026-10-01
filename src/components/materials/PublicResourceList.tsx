"use client";

import { useMemo } from "react";
import { PublicResource } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { resourceService } from "@/lib/services";
import { moduleLabel } from "@/lib/materials/domain";

const TYPE_LABELS: Record<PublicResource["type"], string> = {
  official: "官方发布",
  self_made: "平台自制",
  open: "公开网络资源",
  third_party: "第三方资源",
};

const LICENSE_LABELS: Record<PublicResource["license"], string> = {
  free: "免费",
  paid: "付费",
  open: "开放授权",
  restricted: "授权受限",
  unknown: "授权未知",
};

/**
 * 公共资源只读列表。
 * 本模块不做匹配 / 排行 / 购买；公共资源与用户私有资料分开存储与展示。
 */
export function PublicResourceList() {
  const resources = useMemo(
    () => resourceService.getAll().filter((r) => r.isVerified && r.isActive),
    []
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs leading-relaxed text-blue-800">
        这里是与你个人资料<strong>完全分开</strong>的公共资源库，仅展示已通过审核、来源可核实的资源。
        来源不明的完整扫描资料不会出现在这里。本模块暂不提供与目标的自动匹配，也没有推荐排行。
      </div>

      {resources.length === 0 ? (
        <EmptyState
          icon={<span className="text-4xl">🗂️</span>}
          title="暂无已审核的公共资源"
          description="公共资源需经过来源与版权审核后才会展示。"
        />
      ) : (
        <div className="space-y-3">
          {resources.map((resource) => (
            <Card key={resource.id} padding="sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">{resource.title}</p>
                <Badge variant="info">{TYPE_LABELS[resource.type]}</Badge>
                <Badge variant="muted">{LICENSE_LABELS[resource.license]}</Badge>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{resource.description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {resource.modules.map((key) => (
                  <Badge key={key} variant="primary">
                    {moduleLabel(key)}
                  </Badge>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                <span>来源：{resource.source}</span>
                {resource.applicableRegions.length > 0 && (
                  <span>适用地区：{resource.applicableRegions.join("、")}</span>
                )}
                {resource.verifiedAt && <span>审核时间：{resource.verifiedAt.slice(0, 10)}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
