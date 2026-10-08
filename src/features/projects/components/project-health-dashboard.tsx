"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetProjectHealth } from "@/features/projects/api/use-get-project-health";

// ─── Helper components ───────────────────────────────────────────

function HealthIndicator({
  score,
  status,
}: {
  score: number;
  status: string;
}) {
  const config: Record<string, { emoji: string; color: string; bg: string; label: string }> = {
    HEALTHY: { emoji: "🟢", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", label: "Healthy" },
    GOOD: { emoji: "🟢", color: "text-green-600", bg: "bg-green-50 border-green-200", label: "Good" },
    AT_RISK: { emoji: "🟡", color: "text-amber-600", bg: "bg-amber-50 border-amber-200", label: "At Risk" },
    CRITICAL: { emoji: "🟠", color: "text-orange-600", bg: "bg-orange-50 border-orange-200", label: "Critical" },
    SEVERE: { emoji: "🔴", color: "text-red-600", bg: "bg-red-50 border-red-200", label: "Severe Risk" },
  };

  const c = config[status] || config.AT_RISK;

  return (
    <div className={`flex items-center gap-3 rounded-xl border p-4 ${c.bg}`}>
      <div className="flex flex-col items-center">
        <span className="text-3xl font-bold tracking-tight tabular-nums">{score}</span>
        <span className="text-[10px] text-muted-foreground">/100</span>
      </div>
      <div className="flex flex-col">
        <span className="text-lg leading-tight">
          {c.emoji} <span className={`font-semibold ${c.color}`}>{c.label}</span>
        </span>
        <span className="text-xs text-muted-foreground">Project Health Score</span>
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">Progress</span>
        <span className="font-medium tabular-nums">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  variant,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "danger" | "warning" | "success";
}) {
  const colors = {
    default: "text-foreground",
    danger: "text-red-600",
    warning: "text-amber-600",
    success: "text-emerald-600",
  };
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      <div className="p-2 rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className={`text-lg font-semibold tabular-nums ${colors[variant || "default"]}`}>
          {value}
        </span>
        <span className="text-xs text-muted-foreground truncate">{label}</span>
      </div>
    </div>
  );
}

function RiskBadge({ severity }: { severity: string }) {
  const config: Record<string, { color: string; label: string }> = {
    CRITICAL: { color: "bg-red-100 text-red-800 border-red-300", label: "🔴 Critical" },
    HIGH: { color: "bg-orange-100 text-orange-800 border-orange-300", label: "🟠 High" },
    MEDIUM: { color: "bg-amber-100 text-amber-800 border-amber-300", label: "🟡 Medium" },
    LOW: { color: "bg-blue-100 text-blue-700 border-blue-300", label: "🔵 Low" },
  };
  const c = config[severity] || config.MEDIUM;
  return (
    <Badge variant="outline" className={`text-[10px] font-semibold ${c.color}`}>
      {c.label}
    </Badge>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RiskCard({ risk }: { risk: any }) {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{risk.title}</span>
        <RiskBadge severity={risk.severity} />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{risk.description}</p>
      {risk.affectedTaskNames?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {risk.affectedTaskNames.slice(0, 4).map((name: string) => (
            <Badge key={name} variant="secondary" className="text-[10px] font-normal">
              {name}
            </Badge>
          ))}
          {risk.affectedTaskNames.length > 4 && (
            <Badge variant="secondary" className="text-[10px] font-normal">
              +{risk.affectedTaskNames.length - 4} more
            </Badge>
          )}
        </div>
      )}
      {risk.recommendation && (
        <div className="text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded p-2 mt-1">
          💡 {risk.recommendation}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PriorityItem({ task, rank }: { task: any; rank: number }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0 mt-0.5">
        {rank}
      </div>
      <div className="flex flex-col min-w-0 gap-0.5">
        <span className="text-sm font-medium truncate">{task.taskName}</span>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <Badge variant="outline" className="text-[10px] font-normal">{task.status.replace("_", " ")}</Badge>
          {task.reasons.map((r: string) => (
            <span key={r} className="text-muted-foreground">• {r}</span>
          ))}
        </div>
        {task.assigneeName && task.assigneeName !== "Unassigned" && (
          <span className="text-[10px] text-muted-foreground">
            Assigned to {task.assigneeName}
          </span>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WorkloadRow({ member }: { member: any }) {
  const levelColors: Record<string, string> = {
    Low: "text-emerald-600",
    Medium: "text-amber-600",
    High: "text-red-600",
    LIGHT: "text-emerald-600",
    MODERATE: "text-amber-600",
    HEAVY: "text-orange-600",
    OVERLOADED: "text-red-600",
  };

  return (
    <div className="flex items-center justify-between py-2 px-1 border-b last:border-0">
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium truncate">{member.memberName}</span>
        <span className="text-[10px] text-muted-foreground">
          {member.activeTasks} active · {member.overdueTasks} overdue · weight {member.totalWeight}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs tabular-nums text-muted-foreground">Score: {member.workloadScore}</span>
        <span className={`text-xs font-semibold ${levelColors[member.workloadLevel] || "text-foreground"}`}>
          {member.workloadLevel}
        </span>
      </div>
    </div>
  );
}

// ─── Loading skeleton ────────────────────────────────────────────

function ProjectHealthSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

interface ProjectHealthDashboardProps {
  projectId: string;
}

export const ProjectHealthDashboard = ({ projectId }: ProjectHealthDashboardProps) => {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const { data: health, isLoading, error } = useGetProjectHealth({
    projectId,
    workspaceId,
  });

  if (isLoading) {
    return <ProjectHealthSkeleton />;
  }

  if (error || !health) {
    return null; // Silently hide if health analysis fails
  }

  const hasRisks = health.risks.length > 0;
  const hasRecommendations = health.priorityRecommendations.length > 0;
  const hasWorkloads = health.memberWorkloads.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Health Score & Progress */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-500" />
            Project Health
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <HealthIndicator score={health.healthScore} status={health.healthStatus} />
            <div className="flex-1 flex flex-col justify-center gap-3">
              <ProgressBar value={health.completionRate} />
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{health.completedTasks} of {health.totalTasks} tasks complete</span>
                {health.workloadImbalance && (
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                    Workload Imbalance
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Total Tasks" value={health.totalTasks} icon={Activity} />
        <MetricCard label="Completed" value={health.completedTasks} icon={CheckCircle2} variant="success" />
        <MetricCard label="In Progress" value={health.activeTasks} icon={TrendingUp} />
        <MetricCard
          label="Overdue"
          value={health.overdueTaskCount}
          icon={AlertTriangle}
          variant={health.overdueTaskCount > 0 ? "danger" : "default"}
        />
        <MetricCard
          label="Due Soon"
          value={health.dueSoonTaskCount + health.dueTodayTaskCount}
          icon={Clock}
          variant={health.dueSoonTaskCount + health.dueTodayTaskCount > 0 ? "warning" : "default"}
        />
      </div>

      {/* Risk Summary */}
      {hasRisks && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Risk Summary
              <Badge variant="outline" className="ml-auto text-[10px]">
                {health.risks.length} risk{health.risks.length > 1 ? "s" : ""}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {health.risks.map((risk, i) => (
              <RiskCard key={`${risk.type}-${i}`} risk={risk} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Today's Recommended Focus */}
      {hasRecommendations && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-500" />
              Recommended Focus
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {health.priorityRecommendations.slice(0, 5).map((task, i) => (
              <PriorityItem key={task.taskName} task={task} rank={i + 1} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Team Workload */}
      {hasWorkloads && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-500" />
              Team Workload
              {health.overloadedMemberCount > 0 && (
                <Badge variant="outline" className="ml-auto text-[10px] text-red-600 border-red-300">
                  {health.overloadedMemberCount} overloaded
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {health.memberWorkloads.map((member) => (
              <WorkloadRow key={member.memberName} member={member} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
