"use client";

import { format } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { useParams } from "next/navigation";
import { DottedSeparator } from "@/components/dotted-separator";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, snakeCaseToTitleCase } from "@/lib/utils";

import { useGetProjectHealth } from "../api/use-get-project-health";

interface ProjectHealthDashboardProps {
  projectId: string;
}

/**
 * Mirrors Task 1's workload "High" threshold from
 * `src/features/ai/server/tools.ts` — display only (chart reference line),
 * never used for calculation.
 */
const OVERLOADED_THRESHOLD = 35;

const statusStyles: Record<string, string> = {
  HEALTHY: "border-emerald-500 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400",
  GOOD: "border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400",
  AT_RISK: "border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400",
  CRITICAL: "border-orange-500 text-orange-700 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400",
  SEVERE: "border-red-500 text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-400",
};

const scoreColors: Record<string, string> = {
  HEALTHY: "text-emerald-600",
  GOOD: "text-blue-600",
  AT_RISK: "text-amber-600",
  CRITICAL: "text-orange-600",
  SEVERE: "text-red-600",
};

const severityStyles: Record<string, string> = {
  CRITICAL: "border-red-500 text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-400",
  HIGH: "border-orange-500 text-orange-700 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400",
  MEDIUM: "border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400",
  LOW: "border-slate-400 text-slate-600 bg-slate-50 dark:bg-slate-800/40 dark:text-slate-300",
};

const workloadChartConfig = {
  workload: {
    label: "Workload score",
    color: "#3b82f6",
  },
} satisfies ChartConfig;

const HealthMetric = ({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) => (
  <div className="rounded-lg border bg-muted/30 p-3">
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p className={cn("mt-1 text-xl font-semibold", className)}>{value}</p>
  </div>
);

export const ProjectHealth = ({ projectId }: ProjectHealthDashboardProps) => {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const { data: health, isLoading, isError } = useGetProjectHealth({
  projectId,
  workspaceId,
});

  if (isLoading) {
    return (
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Project Health</CardTitle>
          <CardDescription>Analyzing progress, deadlines and workload…</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !health) {
    return (
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Project Health</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Health analysis is currently unavailable for this project.
          </p>
        </CardContent>
      </Card>
    );
  }

  const workloadData = health.memberWorkloads
    .slice()
    .sort((a, b) => b.workloadScore - a.workloadScore)
    .map((member) => ({
      name: member.memberName,
      score: member.workloadScore,
    }));

  const showWorkloadChart =
    workloadData.length > 0 && health.averageWorkloadScore > 0;

  const dueSoonTotal = health.dueSoonTaskCount + health.dueTodayTaskCount;

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Project Health</CardTitle>
            <CardDescription>
              Deterministic analysis of progress, deadlines and workload.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p
                className={cn(
                  "text-2xl font-bold leading-none",
                  scoreColors[health.healthStatus] ?? "text-foreground",
                )}
              >
                {health.healthScore}
                <span className="text-sm font-medium text-muted-foreground">
                  {" "}/ 100
                </span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Health score
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-sm",
                statusStyles[health.healthStatus] ?? "",
              )}
            >
              {snakeCaseToTitleCase(health.healthStatus)}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-y-5">
        {/* ── Key metrics ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <HealthMetric
            label="Completion"
            value={`${health.completionRate}%`}
            className={health.completionRate >= 75 ? "text-emerald-600" : undefined}
          />
          <HealthMetric label="Total tasks" value={health.totalTasks} />
          <HealthMetric label="Completed" value={health.completedTasks} />
          <HealthMetric
            label="Overdue"
            value={health.overdueTaskCount}
            className={health.overdueTaskCount > 0 ? "text-red-600" : undefined}
          />
          <HealthMetric
            label="Due soon (≤3d)"
            value={dueSoonTotal}
            className={dueSoonTotal > 0 ? "text-orange-600" : undefined}
          />
          <HealthMetric
            label="High-priority pending"
            value={health.highPriorityPendingCount}
            className={
              health.highPriorityPendingCount > 0 ? "text-amber-600" : undefined
            }
          />
          <HealthMetric
            label="In progress"
            value={health.activeTasks}
          />
          <HealthMetric
            label="Backlog"
            value={health.backlogTasks}
          />
          <HealthMetric
            label="Overloaded members"
            value={health.overloadedMemberCount}
            className={
              health.overloadedMemberCount > 0 ? "text-red-600" : undefined
            }
          />
        </div>

        <DottedSeparator />

        {/* ── Top risks ───────────────────────────────────────────── */}
        <section className="flex flex-col gap-y-3">
          <h3 className="text-sm font-semibold">Top Risks</h3>
          {health.risks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No risks detected — nothing is overdue, due imminently, or
              unevenly distributed.
            </p>
          ) : (
            <ul className="flex flex-col gap-y-3">
              {health.risks.map((risk, i) => (
                <li key={`${risk.type}-${i}`} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{risk.title}</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0",
                        severityStyles[risk.severity] ?? "",
                      )}
                    >
                      {snakeCaseToTitleCase(risk.severity)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {risk.description}
                  </p>
                  {risk.affectedTaskNames.length > 0 && (
                    <p className="mt-2 text-xs">
                      <span className="font-medium">Affected: </span>
                      {risk.affectedTaskNames.join(", ")}
                    </p>
                  )}
                  {risk.affectedMemberNames.length > 0 && (
                    <p className="mt-1 text-xs">
                      <span className="font-medium">Members: </span>
                      {risk.affectedMemberNames.join(", ")}
                    </p>
                  )}
                  {risk.recommendation && (
                    <p className="mt-2 text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded p-2">
                      💡 {risk.recommendation}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <DottedSeparator />

        {/* ── Priority queue ──────────────────────────────────────── */}
        <section className="flex flex-col gap-y-3">
          <h3 className="text-sm font-semibold">What to prioritize next</h3>
          {health.priorityRecommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing pending — all tasks in this project are complete.
            </p>
          ) : (
            <ol className="flex flex-col gap-y-2">
              {health.priorityRecommendations.map((task, index) => (
                <li
                  key={`${task.taskName}-${index}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border p-3"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {index + 1}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">
                    {task.taskName}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {task.assigneeName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Weight {task.weight}
                  </span>
                  {task.dueDate && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(task.dueDate), "MMM d, yyyy")}
                    </span>
                  )}
                  <Badge variant="secondary" className="text-[11px]">
                    {snakeCaseToTitleCase(task.status)}
                  </Badge>
                  <p className="w-full text-xs text-muted-foreground">
                    {task.reasons.join(" · ")}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* ── Workload distribution (Task 1 canonical scores) ─────── */}
        {showWorkloadChart && (
          <>
            <DottedSeparator />
            <section className="flex flex-col gap-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  Workload distribution
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  Red line = overloaded threshold ({OVERLOADED_THRESHOLD})
                </span>
              </div>
              <ChartContainer
                config={workloadChartConfig}
                className="h-[260px] w-full"
              >
                <BarChart
                  data={workloadData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    width={130}
                  />
                  <ReferenceLine
                    x={OVERLOADED_THRESHOLD}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                  />
                  <Bar
                    dataKey="score"
                    fill="var(--color-workload)"
                    radius={4}
                  />
                </BarChart>
              </ChartContainer>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
};
