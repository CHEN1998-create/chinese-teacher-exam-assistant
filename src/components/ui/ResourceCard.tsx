import { PublicResource } from "@/types";
import { Card } from "./Card";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { formatTime } from "@/lib/utils";

interface ResourceCardProps {
  resource: PublicResource;
  estimatedTime?: number;
  matchReason?: string;
  onAddToPlan?: (resourceId: string) => void;
  showAddButton?: boolean;
}

export function ResourceCard({
  resource,
  estimatedTime,
  matchReason,
  onAddToPlan,
  showAddButton = true,
}: ResourceCardProps) {
  const typeLabels: Record<string, string> = {
    official: "官方",
    self_made: "自制",
    open: "开放",
    third_party: "第三方",
  };

  const licenseLabels: Record<string, string> = {
    free: "免费",
    paid: "付费",
    open: "开放",
    restricted: "受限",
    unknown: "未知",
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="font-medium text-slate-900">{resource.title}</h4>
        <Badge variant={resource.type === "official" ? "success" : "muted"}>
          {typeLabels[resource.type]}
        </Badge>
      </div>

      <p className="text-sm text-slate-600 mb-3 line-clamp-2">
        {resource.description}
      </p>

      {matchReason && (
        <p className="text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-lg mb-3">
          <span className="font-medium">推荐理由：</span>
          {matchReason}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {resource.modules.slice(0, 3).map((mod) => (
          <span
            key={mod}
            className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded"
          >
            {mod}
          </span>
        ))}
        {resource.modules.length > 3 && (
          <span className="px-2 py-0.5 text-slate-400 text-xs">
            +{resource.modules.length - 3}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>来源：{resource.source}</span>
          <span>{licenseLabels[resource.license]}</span>
          {estimatedTime && <span>约{formatTime(estimatedTime)}</span>}
        </div>
        {showAddButton && onAddToPlan && (
          <Button size="sm" variant="outline" onClick={() => onAddToPlan(resource.id)}>
            加入本周计划
          </Button>
        )}
      </div>

      {!resource.isVerified && (
        <p className="mt-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
          该资源尚未经过审核
        </p>
      )}
    </Card>
  );
}
