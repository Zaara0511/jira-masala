/**
 * Project Health Engine
 *
 * Deterministic analysis of project health, risk detection, and
 * actionable recommendations. The AI (Gemini) is NOT used here —
 * every metric and risk is calculated from real Appwrite data.
 *
 * Workload scoring REUSES the exact computeWorkloadScore() from
 * Task 1 (src/features/ai/server/tools.ts).  No duplicate formula.
 */

import { Query, type Databases } from "node-appwrite";
import {
  DATABASE_ID,
  TASKS_ID,
  MEMBERS_ID,
  PROJECTS_ID,
} from "@/config";
import { TaskStatus } from "@/features/tasks/types";
import { createAdminClient } from "@/lib/appwrite";
import {
  computeWorkloadScore,
  DUE_SOON_DAYS,
  WORKLOAD_LEVEL_HIGH_THRESHOLD,
  type WorkloadTaskInput,
} from "./tools";

// ─── Types ───────────────────────────────────────────────────────

export type HealthStatus = "HEALTHY" | "GOOD" | "AT_RISK" | "CRITICAL" | "SEVERE";
export type RiskSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RiskType =
  | "OVERDUE_TASKS"
  | "DEADLINE_PRESSURE"
  | "WORKLOAD_IMBALANCE"
  | "HIGH_PRIORITY_BACKLOG"
  | "OVERLOADED_MEMBER"
  | "STALLED_TASKS";

export interface ProjectRisk {
  type: RiskType;
  severity: RiskSeverity;
  title: string;
  description: string;
  affectedTaskNames: string[];
  affectedMemberNames: string[];
  metric: number;
  recommendation: string;
}

export interface MemberWorkloadSummary {
  memberName: string;
  activeTasks: number;
  totalWeight: number;
  overdueTasks: number;
  upcomingDeadlines: number;
  workloadScore: number;
  workloadLevel: string;
  /** percentage of total project weight this member owns */
  weightShare: number;
}

export interface TaskPriority {
  taskName: string;
  status: TaskStatus;
  dueDate: string | null;
  weight: number;
  assigneeName: string;
  priorityScore: number;
  reasons: string[];
}

export interface StatusDistribution {
  backlog: number;
  todo: number;
  inProgress: number;
  inReview: number;
  done: number;
}

export interface ProjectHealthResult {
  projectName: string;
  healthScore: number;
  healthStatus: HealthStatus;
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  backlogTasks: number;
  overdueTaskCount: number;
  dueTodayTaskCount: number;
  dueSoonTaskCount: number;
  highPriorityPendingCount: number;
  statusDistribution: StatusDistribution;
  risks: ProjectRisk[];
  memberWorkloads: MemberWorkloadSummary[];
  priorityRecommendations: TaskPriority[];
  overloadedMemberCount: number;
  workloadImbalance: boolean;
  averageWorkloadScore: number;
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Normalise a date to midnight for day-level comparison. */
function dayStart(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function diffDays(a: Date, b: Date): number {
  return Math.ceil((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function healthStatusFromScore(score: number): HealthStatus {
  if (score >= 90) return "HEALTHY";
  if (score >= 75) return "GOOD";
  if (score >= 50) return "AT_RISK";
  if (score >= 25) return "CRITICAL";
  return "SEVERE";
}

// ─── Interfaces for raw Appwrite docs ────────────────────────────

interface RawTask {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  name: string;
  status: TaskStatus;
  workspaceId: string;
  assigneeId: string;
  projectId: string;
  dueDate?: string;
  weight?: number;
  description?: string;
}

interface RawMember {
  $id: string;
  userId: string;
  role: string;
  workspaceId: string;
}

interface RawProject {
  $id: string;
  name: string;
  workspaceId: string;
}

// ─── Main Engine ─────────────────────────────────────────────────

export async function analyzeProjectHealth(
  databases: Databases,
  workspaceId: string,
  projectId: string,
): Promise<ProjectHealthResult> {
  const HIGH_WEIGHT_THRESHOLD = 4; // weight >= 4 is "high priority"

  // ── 1. Fetch data ──────────────────────────────────────────────

  const [projectDoc, tasksResult, membersResult] = await Promise.all([
    databases.getDocument(
      DATABASE_ID,
      PROJECTS_ID,
      projectId
    ) as unknown as Promise<RawProject>,
    databases.listDocuments(DATABASE_ID, TASKS_ID, [
      Query.equal("projectId", projectId),
      Query.limit(500),
    ]),
    databases.listDocuments(DATABASE_ID, MEMBERS_ID, [
      Query.equal("workspaceId", workspaceId),
      Query.limit(200),
    ]),
  ]);

  const tasks = tasksResult.documents as unknown as RawTask[];
  const members = membersResult.documents as unknown as RawMember[];

  // Resolve member names via admin client
  const { users: usersAdmin } = await createAdminClient();
  const memberNameMap = new Map<string, string>();
  await Promise.all(
    members.map(async (m) => {
      try {
        const u = await usersAdmin.get(m.userId);
        memberNameMap.set(m.$id, u.name || u.email);
      } catch {
        memberNameMap.set(m.$id, "Unknown");
      }
    }),
  );

  const memberName = (id: string) => memberNameMap.get(id) || "Unassigned";

  // ── 2. Date-aware classification ───────────────────────────────

  const now = new Date();
  const today = dayStart(now);

  const completedStatuses: TaskStatus[] = [TaskStatus.DONE];
  const activeStatuses: TaskStatus[] = [TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW];
  const backlogStatuses: TaskStatus[] = [TaskStatus.BACKLOG, TaskStatus.TODO];

  const completedTasks = tasks.filter((t) => completedStatuses.includes(t.status));
  const incompleteTasks = tasks.filter((t) => !completedStatuses.includes(t.status));
  const activeTasks = tasks.filter((t) => activeStatuses.includes(t.status));
  const backlogTasks = tasks.filter((t) => backlogStatuses.includes(t.status));

  const overdueTasks = incompleteTasks.filter((t) => {
    if (!t.dueDate) return false;
    return dayStart(new Date(t.dueDate)) < today;
  });

  const dueTodayTasks = incompleteTasks.filter((t) => {
    if (!t.dueDate) return false;
    return dayStart(new Date(t.dueDate)).getTime() === today.getTime();
  });

  const dueSoonTasks = incompleteTasks.filter((t) => {
    if (!t.dueDate) return false;
    const due = dayStart(new Date(t.dueDate));
    const diff = diffDays(due, today);
    return diff > 0 && diff <= DUE_SOON_DAYS;
  });

  const highPriorityPending = incompleteTasks.filter(
    (t) => (t.weight ?? 1) >= HIGH_WEIGHT_THRESHOLD,
  );

  const statusDistribution: StatusDistribution = {
    backlog: tasks.filter((t) => t.status === TaskStatus.BACKLOG).length,
    todo: tasks.filter((t) => t.status === TaskStatus.TODO).length,
    inProgress: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
    inReview: tasks.filter((t) => t.status === TaskStatus.IN_REVIEW).length,
    done: completedTasks.length,
  };

  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 100;

  // ── 3. Workload per member – reuse Task 1's computeWorkloadScore ──

  const tasksByAssignee = new Map<string, RawTask[]>();
  for (const t of incompleteTasks) {
    if (!t.assigneeId) continue;
    const list = tasksByAssignee.get(t.assigneeId) || [];
    list.push(t);
    tasksByAssignee.set(t.assigneeId, list);
  }

  const totalProjectWeight = incompleteTasks.reduce((s, t) => s + (t.weight ?? 1), 0);

  const memberWorkloads: MemberWorkloadSummary[] = members.map((m) => {
    const memberTasks = tasksByAssignee.get(m.$id) || [];

    // Map to WorkloadTaskInput for reuse with computeWorkloadScore
    const taskInputs: WorkloadTaskInput[] = memberTasks.map((t) => ({
      status: t.status,
      dueDate: t.dueDate,
      weight: t.weight,
    }));

    const wl = computeWorkloadScore(taskInputs, now);

    return {
      memberName: memberName(m.$id),
      activeTasks: wl.activeTasks,
      totalWeight: wl.activeWeight,
      overdueTasks: wl.overdueTasks,
      upcomingDeadlines: wl.upcomingDeadlineTasks,
      workloadScore: wl.workloadScore,
      workloadLevel: wl.workloadLevel,
      weightShare: totalProjectWeight > 0
        ? Math.round((wl.activeWeight / totalProjectWeight) * 100)
        : 0,
    };
  });

  const avgWorkload =
    memberWorkloads.length > 0
      ? memberWorkloads.reduce((s, w) => s + w.workloadScore, 0) / memberWorkloads.length
      : 0;

  const overloadedMembers = memberWorkloads.filter(
    (w) => w.workloadScore >= WORKLOAD_LEVEL_HIGH_THRESHOLD,
  );

  const hasImbalance =
    memberWorkloads.length > 1 &&
    Math.max(...memberWorkloads.map((w) => w.workloadScore)) > avgWorkload * 1.5;

  // ── 4. Health Score (deterministic) ────────────────────────────
  //
  // Base = 100, with deductions for various risk factors.
  // Each factor has a maximum deduction to avoid the score going
  // excessively negative from a single issue.
  //
  let score = 100;

  // 4a. Completion penalty: up to -15 for low completion
  if (totalTasks > 0) {
    const completionPenalty = Math.min(15, (1 - completionRate / 100) * 15);
    score -= completionPenalty;
  }

  // 4b. Overdue penalty: -5 per overdue task, max -25
  score -= Math.min(25, overdueTasks.length * 5);

  // 4c. Deadline pressure: -3 per due-soon task, max -15
  score -= Math.min(15, dueSoonTasks.length * 3);

  // 4d. High-priority pending: -2 per high-priority incomplete task, max -15
  score -= Math.min(15, highPriorityPending.length * 2);

  // 4e. Overloaded members: -5 per overloaded member, max -10
  score -= Math.min(10, overloadedMembers.length * 5);

  // 4f. Workload imbalance: -5
  if (hasImbalance) score -= 5;

  // 4g. Due today pressure: -2 per task due today, max -10
  score -= Math.min(10, dueTodayTasks.length * 2);

  // Clamp to [0, 100]
  const healthScore = Math.max(0, Math.min(100, Math.round(score)));
  const healthStatus = healthStatusFromScore(healthScore);

  // ── 5. Risk Detection ─────────────────────────────────────────

  const risks: ProjectRisk[] = [];

  // 5a. Overdue tasks
  if (overdueTasks.length > 0) {
    const highOverdue = overdueTasks.filter((t) => (t.weight ?? 1) >= HIGH_WEIGHT_THRESHOLD);
    const severity: RiskSeverity =
      highOverdue.length >= 3 ? "CRITICAL" : overdueTasks.length >= 3 ? "HIGH" : "MEDIUM";

    risks.push({
      type: "OVERDUE_TASKS",
      severity,
      title: `${overdueTasks.length} task${overdueTasks.length > 1 ? "s" : ""} overdue`,
      description: `${overdueTasks.length} task${overdueTasks.length > 1 ? "s are" : " is"} past ${overdueTasks.length > 1 ? "their" : "its"} due date and still incomplete.`,
      affectedTaskNames: overdueTasks.map((t) => t.name),
      affectedMemberNames: Array.from(
        new Set(overdueTasks.map((t) => memberName(t.assigneeId)))
      ),
      metric: overdueTasks.length,
      recommendation:
        overdueTasks.length >= 3
          ? "Prioritize overdue high-weight tasks before taking on new work."
          : "Address the overdue task as soon as possible.",
    });
  }

  // 5b. Deadline pressure
  const urgentSoon = [...dueTodayTasks, ...dueSoonTasks];
  const highPrioritySoon = urgentSoon.filter((t) => (t.weight ?? 1) >= HIGH_WEIGHT_THRESHOLD);
  if (urgentSoon.length > 0) {
    const severity: RiskSeverity =
      highPrioritySoon.length >= 3 ? "CRITICAL" : highPrioritySoon.length >= 1 ? "HIGH" : "MEDIUM";

    risks.push({
      type: "DEADLINE_PRESSURE",
      severity,
      title: `${urgentSoon.length} task${urgentSoon.length > 1 ? "s" : ""} due within ${DUE_SOON_DAYS} days`,
      description: `${highPrioritySoon.length} high-priority and ${urgentSoon.length - highPrioritySoon.length} other task${urgentSoon.length > 1 ? "s are" : " is"} due within the next ${DUE_SOON_DAYS} days.`,
      affectedTaskNames: urgentSoon.map((t) => t.name),
      affectedMemberNames: Array.from(
        new Set(urgentSoon.map((t) => memberName(t.assigneeId)))
      ),
      metric: urgentSoon.length,
      recommendation: `Focus the team on high-priority tasks due within the next ${DUE_SOON_DAYS} days.`,
    });
  }

  // 5c. Overloaded members
  for (const ol of overloadedMembers) {
    risks.push({
      type: "OVERLOADED_MEMBER",
      severity: ol.workloadScore > 60 ? "HIGH" : "MEDIUM",
      title: `${ol.memberName} is overloaded`,
      description: `${ol.memberName} currently has ${ol.activeTasks} active tasks with a workload score of ${ol.workloadScore}. This is significantly above the team average of ${Math.round(avgWorkload)}.`,
      affectedTaskNames: (tasksByAssignee.get(
        members.find((m2) => memberName(m2.$id) === ol.memberName)?.$id ?? ""
      ) || []).map((t) => t.name).slice(0, 5),
      affectedMemberNames: [ol.memberName],
      metric: ol.workloadScore,
      recommendation: `Consider redistributing suitable tasks from ${ol.memberName} to team members with available capacity.`,
    });
  }

  // 5d. Workload imbalance
  if (hasImbalance && memberWorkloads.length > 1) {
    const mostLoaded = memberWorkloads.reduce((a, b) =>
      a.workloadScore > b.workloadScore ? a : b,
    );
    const severity: RiskSeverity = mostLoaded.weightShare > 60 ? "HIGH" : "MEDIUM";

    risks.push({
      type: "WORKLOAD_IMBALANCE",
      severity,
      title: "Workload is unevenly distributed",
      description: `${mostLoaded.memberName} owns ${mostLoaded.weightShare}% of the project's active task weight. The team average workload score is ${Math.round(avgWorkload)}, but ${mostLoaded.memberName}'s score is ${mostLoaded.workloadScore}.`,
      affectedTaskNames: [],
      affectedMemberNames: [mostLoaded.memberName],
      metric: mostLoaded.weightShare,
      recommendation: "Redistribute lower-priority tasks to team members with lighter workload.",
    });
  }

  // 5e. High-priority backlog
  const highPriorityInBacklog = backlogTasks.filter(
    (t) => (t.weight ?? 1) >= HIGH_WEIGHT_THRESHOLD,
  );
  if (highPriorityInBacklog.length >= 2) {
    const severity: RiskSeverity = highPriorityInBacklog.length >= 5 ? "HIGH" : "MEDIUM";

    risks.push({
      type: "HIGH_PRIORITY_BACKLOG",
      severity,
      title: `${highPriorityInBacklog.length} high-priority tasks still in backlog`,
      description: `${highPriorityInBacklog.length} high-priority task${highPriorityInBacklog.length > 1 ? "s remain" : " remains"} in backlog/todo status and ha${highPriorityInBacklog.length > 1 ? "ve" : "s"} not been started.`,
      affectedTaskNames: highPriorityInBacklog.map((t) => t.name),
      affectedMemberNames: Array.from(
        new Set(highPriorityInBacklog.map((t) => memberName(t.assigneeId)))
      ),
      metric: highPriorityInBacklog.length,
      recommendation: "Move high-priority backlog tasks into active status and assign them to available team members.",
    });
  }

  // 5f. Stalled tasks (tasks unchanged for > 7 days in a non-completed status)
  const STALL_THRESHOLD_DAYS = 7;
  const stalledTasks = incompleteTasks.filter((t) => {
    if (!t.$updatedAt) return false;
    if (t.status === TaskStatus.BACKLOG) return false; // backlog is expected to be idle
    const lastUpdate = new Date(t.$updatedAt);
    return diffDays(today, dayStart(lastUpdate)) >= STALL_THRESHOLD_DAYS;
  });

  if (stalledTasks.length > 0) {
    risks.push({
      type: "STALLED_TASKS",
      severity: stalledTasks.length >= 3 ? "HIGH" : "MEDIUM",
      title: `${stalledTasks.length} task${stalledTasks.length > 1 ? "s appear" : " appears"} to have stalled`,
      description: `${stalledTasks.length} task${stalledTasks.length > 1 ? "s have" : " has"} not been updated in over ${STALL_THRESHOLD_DAYS} days while in an active status.`,
      affectedTaskNames: stalledTasks.map((t) => t.name),
      affectedMemberNames: Array.from(
        new Set(stalledTasks.map((t) => memberName(t.assigneeId)))
      ),
      metric: stalledTasks.length,
      recommendation: "Review stalled tasks to determine if they are blocked, deprioritized, or need reassignment.",
    });
  }

  // Sort risks by severity
  const severityOrder: Record<RiskSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // ── 6. Priority Recommendations ───────────────────────────────
  //
  // Deterministic priority score for each incomplete task.
  //   priorityScore = urgencyScore * weight
  //
  const priorityRecommendations: TaskPriority[] = incompleteTasks
    .map((t) => {
      const weight = t.weight ?? 1;
      const reasons: string[] = [];
      let urgency = 1;

      // Overdue penalty
      if (t.dueDate && dayStart(new Date(t.dueDate)) < today) {
        const daysOverdue = diffDays(today, dayStart(new Date(t.dueDate)));
        urgency += 3 + Math.min(daysOverdue * 0.5, 5);
        reasons.push(`Overdue by ${daysOverdue} day${daysOverdue > 1 ? "s" : ""}`);
      }

      // Due today
      if (t.dueDate && dayStart(new Date(t.dueDate)).getTime() === today.getTime()) {
        urgency += 2.5;
        reasons.push("Due today");
      }

      // Due soon
      if (t.dueDate) {
        const d = diffDays(dayStart(new Date(t.dueDate)), today);
        if (d > 0 && d <= DUE_SOON_DAYS) {
          urgency += 1.5;
          reasons.push(`Due in ${d} day${d > 1 ? "s" : ""}`);
        }
      }

      // In-progress boost (already started = should finish)
      if (t.status === TaskStatus.IN_PROGRESS) {
        urgency += 0.5;
        reasons.push("Currently in progress");
      }

      // High weight
      if (weight >= HIGH_WEIGHT_THRESHOLD) {
        reasons.push("High priority");
      }

      const priorityScore = Math.round(urgency * weight * 100) / 100;

      return {
        taskName: t.name,
        status: t.status,
        dueDate: t.dueDate || null,
        weight,
        assigneeName: memberName(t.assigneeId),
        priorityScore,
        reasons,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 10); // top 10

  // ── 7. Assemble result ─────────────────────────────────────────

  return {
    projectName: projectDoc.name,
    healthScore,
    healthStatus,
    completionRate: Math.round(completionRate * 10) / 10,
    totalTasks,
    completedTasks: completedTasks.length,
    activeTasks: activeTasks.length,
    backlogTasks: backlogTasks.length,
    overdueTaskCount: overdueTasks.length,
    dueTodayTaskCount: dueTodayTasks.length,
    dueSoonTaskCount: dueSoonTasks.length,
    highPriorityPendingCount: highPriorityPending.length,
    statusDistribution,
    risks,
    memberWorkloads,
    priorityRecommendations,
    overloadedMemberCount: overloadedMembers.length,
    workloadImbalance: hasImbalance,
    averageWorkloadScore: Math.round(avgWorkload * 100) / 100,
  };
}
