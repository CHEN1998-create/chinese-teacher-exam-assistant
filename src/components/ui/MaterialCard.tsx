import { UserMaterial } from "@/types";
import { Card } from "./Card";
import { Progress } from "./Progress";
import { MaterialStatusBadge } from "./Badge";

interface MaterialCardProps {
  material: UserMaterial;
  onUpdateStatus?: (id: string, status: UserMaterial["status"]) => void;
}

export function MaterialCard({ material }: MaterialCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h4 className="font-medium text-slate-900">{material.name}</h4>
          {material.author && (
            <p className="text-xs text-slate-500 mt-0.5">
              {material.author} {material.year && `· ${material.year}`}
            </p>
          )}
        </div>
        {material.status && <MaterialStatusBadge status={material.status} />}
      </div>

      <div className="mt-3">
        <Progress value={material.progress} showLabel size="sm" />
      </div>

      {material.diagnosis && (
        <div className="mt-3 p-3 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-700">
            <span className="font-medium">诊断：</span>
            {material.diagnosis.reason}
          </p>
          {material.diagnosis.missingModules.length > 0 && (
            <div className="mt-2">
              <span className="text-xs font-medium text-slate-500">缺少模块：</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {material.diagnosis.missingModules.map((mod) => (
                  <span
                    key={mod}
                    className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full"
                  >
                    {mod}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {material.chapters.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500 mb-1.5">章节进度</p>
          <div className="space-y-1.5">
            {material.chapters.map((chapter) => (
              <div
                key={chapter.id}
                className="flex items-center justify-between text-sm"
              >
                <span className={chapter.isCompleted ? "text-slate-400 line-through" : "text-slate-700"}>
                  {chapter.title}
                </span>
                {chapter.isCompleted && (
                  <span className="text-emerald-600 text-xs">✓</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
