import { ResourceItem, RESOURCE_TYPE_LABELS, RIGHTS_STATUS_LABELS } from "@/types";
import { Card } from "./Card";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { formatTime } from "@/lib/utils";
import { moduleLabel } from "@/lib/materials/domain";

interface ResourceCardProps {
  resource: ResourceItem;
  estimatedTime?: number;
  matchReason?: string;
  onAddToPlan?: (resourceId: string) => void;
  showAddButton?: boolean;
}

/**
 * 通用公共资源卡（新资源模型 ResourceItem）。
 * 缺口页使用更完整的 GapResourcePanel；此卡保留给需要简单资源展示的页面复用。
 */
export function ResourceCard({
  resource,
  estimatedTime,
  matchReason,
  onAddToPlan,
  showAddButton = true,
}: ResourceCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="font-medium text-slate-900">{resource.title}</h4>
        <Badge variant={resource.rightsStatus === "official" ? "success" : "muted"}>
          {RESOURCE_TYPE_LABELS[resource.resourceType]}
        </Badge>
      </div>

      {resource.description && (
        <p className="text-sm text-slate-600 mb-3 line-clamp-2">{resource.description}</p>
      )}

      {matchReason && (
        <p className="text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-lg mb-3">
          <span className="font-medium">推荐理由：</span>
          {matchReason}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {resource.modules.slice(0, 3).map((mod) => (
          <span key={mod} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
            {moduleLabel(mod)}
          </span>
        ))}
        {resource.modules.length > 3 && (
          <span className="px-2 py-0.5 text-slate-400 text-xs">+{resource.modules.length - 3}</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>来源：{resource.sourceName}</span>
          <span>{RIGHTS_STATUS_LABELS[resource.rightsStatus]}</span>
          {(estimatedTime ?? resource.estimatedMinutes) > 0 && (
            <span>约{formatTime(estimatedTime ?? resource.estimatedMinutes)}</span>
          )}
        </div>
        {showAddButton && onAddToPlan && (
          <Button size="sm" variant="outline" onClick={() => onAddToPlan(resource.id)}>
            加入本周计划
          </Button>
        )}
      </div>
    </Card>
  );
}
