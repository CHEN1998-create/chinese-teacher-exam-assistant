import { PlanTask } from "@/types";
import { Card } from "./Card";
import { Badge, TaskStatusBadge } from "./Badge";
import { formatTime } from "@/lib/utils";

interface TaskCardProps {
  task: PlanTask;
  showFeedback?: boolean;
  onStart?: (taskId: string) => void;
  compact?: boolean;
}

export function TaskCard({ task, showFeedback = true, compact = false }: TaskCardProps) {
  return (
    <Card
      className={compact ? "p-3" : ""}
      padding={compact ? "sm" : "md"}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <TaskStatusBadge status={task.status} />
            {task.isCore && (
              <Badge variant="primary">核心</Badge>
            )}
            <span className="text-xs text-slate-400">{task.module}</span>
          </div>
          <h4 className="font-medium text-slate-900 mt-1">{task.title}</h4>
          <p className="text-sm text-slate-600 mt-1">{task.completionCriteria}</p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-sm font-medium text-slate-900">
            {formatTime(task.estimatedTime)}
          </span>
        </div>
      </div>

      {showFeedback && task.feedback && (
        <div className="mt-3 p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">实际用时：</span>
            <span className="font-medium">
              {task.feedback.actualTime ? formatTime(task.feedback.actualTime) : "-"}
            </span>
            {task.feedback.hasSecondPractice && (
              <Badge variant="success">已二次练习</Badge>
            )}
          </div>
          {task.feedback.errorTypes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {task.feedback.errorTypes.map((type) => (
                <span
                  key={type}
                  className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded"
                >
                  {type}
                </span>
              ))}
            </div>
          )}
          {task.feedback.notes && (
            <p className="mt-2 text-sm text-slate-600">{task.feedback.notes}</p>
          )}
        </div>
      )}
    </Card>
  );
}
