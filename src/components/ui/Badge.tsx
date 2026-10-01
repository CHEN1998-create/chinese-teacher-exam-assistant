import { cn } from "@/lib/utils";
import { EvidenceLevel, TaskStatus, MaterialStatus } from "@/types";
import { EVIDENCE_LEVEL_LABELS, TASK_STATUS_LABELS, MATERIAL_STATUS_LABELS } from "@/types";

interface BadgeProps {
  variant?: "default" | "primary" | "success" | "warning" | "danger" | "info" | "muted";
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: "bg-gray-100 text-gray-700",
  primary: "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-cyan-50 text-cyan-700",
  muted: "bg-slate-100 text-slate-600",
};

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// 证据等级标签
export function EvidenceBadge({ level }: { level: EvidenceLevel }) {
  const variantMap: Record<EvidenceLevel, BadgeProps["variant"]> = {
    official: "success",
    historical: "info",
    personal: "muted",
    pending: "warning",
  };
  return (
    <Badge variant={variantMap[level]}>
      {EVIDENCE_LEVEL_LABELS[level]}
    </Badge>
  );
}

// 任务状态标签
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const variantMap: Record<TaskStatus, BadgeProps["variant"]> = {
    pending: "muted",
    in_progress: "primary",
    completed: "success",
    partial: "warning",
    abandoned: "danger",
  };
  return (
    <Badge variant={variantMap[status]}>
      {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}

// 资料状态标签
export function MaterialStatusBadge({ status }: { status: MaterialStatus }) {
  const variantMap: Record<MaterialStatus, BadgeProps["variant"]> = {
    in_use: "success",
    partial_use: "warning",
    paused: "muted",
    replaced: "danger",
  };
  return (
    <Badge variant={variantMap[status]}>
      {MATERIAL_STATUS_LABELS[status]}
    </Badge>
  );
}
