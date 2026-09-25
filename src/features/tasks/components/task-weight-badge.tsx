import { cn } from "@/lib/utils";
import { TaskWeight } from "../types";

interface TaskWeightBadgeProps {
  weight?: number | null;
  className?: string;
  showUnweighted?: boolean;
}

export const taskWeightConfig: Record<
  number,
  { label: string; shortLabel: string; className: string }
> = {
  [TaskWeight.VERY_LOW]: {
    label: "1 · Very Low",
    shortLabel: "Very Low",
    className: "bg-slate-100 text-slate-700 border-slate-300",
  },
  [TaskWeight.LOW]: {
    label: "2 · Low",
    shortLabel: "Low",
    className: "bg-blue-100 text-blue-700 border-blue-300",
  },
  [TaskWeight.MEDIUM]: {
    label: "3 · Medium",
    shortLabel: "Medium",
    className: "bg-amber-100 text-amber-800 border-amber-300",
  },
  [TaskWeight.HIGH]: {
    label: "4 · High",
    shortLabel: "High",
    className: "bg-orange-100 text-orange-800 border-orange-300",
  },
  [TaskWeight.CRITICAL]: {
    label: "5 · Critical",
    shortLabel: "Critical",
    className: "bg-red-100 text-red-800 border-red-300",
  },
};

export const TaskWeightBadge = ({
  weight,
  className,
  showUnweighted = true,
}: TaskWeightBadgeProps) => {
  if (!weight || !taskWeightConfig[weight]) {
    if (!showUnweighted) return null;

    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md border border-dashed border-neutral-300 px-2 py-0.5 text-xs font-medium text-neutral-400 select-none",
          className
        )}
      >
        Unweighted
      </span>
    );
  }

  const config = taskWeightConfig[weight];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold select-none transition-colors",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
};
