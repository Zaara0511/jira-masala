import { tool } from "ai";
import { z } from "zod";
import { Query, type Databases } from "node-appwrite";
import {
  DATABASE_ID,
  PROJECTS_ID,
  TASKS_ID,
  MEMBERS_ID,
} from "@/config";
import { TaskStatus } from "@/features/tasks/types";
import { getMember } from "@/features/members/utils";
import { createAdminClient } from "@/lib/appwrite";

interface AIUser {
  $id: string;
  name?: string;
  email?: string;
}

interface AIProject {
  $id: string;
  name: string;
  imageUrl?: string;
}

interface AITask {
  $id: string;
  name: string;
  status: TaskStatus;
  dueDate?: string;
  projectId: string;
  assigneeId: string;
  description?: string;
  weight?: number;
}

interface AIMember {
  $id: string;
  userId: string;
  role: string;
  designation?: string;
}

/**
 * ─── CANONICAL TASK 1 WORKLOAD ENGINE ─────────────────────────────
 *
 * This is the SINGLE source of truth for workload scoring in the app.
 * It is used by:
 *   - the `getMembersWithWorkload` AI tool (Task 1 fair assignment), and
 *   - the Project Health engine (`../project-health.ts`) (Task 2).
 *
 * Do NOT duplicate this formula anywhere else.
 */

/** Default weight applied to unweighted tasks (Task 1 convention: MEDIUM). */
export const DEFAULT_TASK_WEIGHT = 3;

/** Deadline window used by Task 1 (and Project Health): tasks due within 3 days. */
export const DUE_SOON_DAYS = 3;

/** Task 1 workload level that counts as an "overloaded" member. */
export const OVERLOADED_WORKLOAD_LEVEL = "High";

/** Task 1 workload level boundaries (score thresholds). */
export const WORKLOAD_LEVEL_MEDIUM_THRESHOLD = 15;
export const WORKLOAD_LEVEL_HIGH_THRESHOLD = 35;

export interface WorkloadTaskInput {
  status: TaskStatus;
  dueDate?: string;
  weight?: number;
};

export interface WorkloadScore {
  activeTasks: number;
  activeWeight: number;
  overdueTasks: number;
  upcomingDeadlineTasks: number;
  workloadScore: number;
  workloadLevel: "Low" | "Medium" | "High";
};

/**
 * Compute a deterministic workload score for a member based on their active tasks.
 *
 * Formula:
 *   baseWeight       = sum of (task.weight ?? 3) for all active tasks
 *   overduePenalty    = overdueCount * 4
 *   deadlinePressure  = count of tasks due within 3 days * 2
 *   taskCountFactor   = activeCount * 0.5  (mild penalty for juggling many tasks)
 *
 *   workloadScore = baseWeight + overduePenalty + deadlinePressure + taskCountFactor
 *
 * Thresholds (workload levels):
 *   Low    : score <  15
 *   Medium : score >= 15 and < 35
 *   High   : score >= 35   (an "overloaded" member for Project Health)
 *
 * Deadline model (single deadline concept for the whole app):
 *   overdue            = due date before the start of "today"
 *   upcomingDeadline   = due within the next 3 days (today .. today + 3d)
 *
 * @param tasks Tasks belonging to a single member (any status; DONE is ignored).
 * @param now   Centralised reference time so one analysis is internally consistent.
 *              Defaults to the current server time.
 */
export function computeWorkloadScore(
  tasks: WorkloadTaskInput[],
  now: Date = new Date(),
): WorkloadScore {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + DUE_SOON_DAYS);

  const activeTasks = tasks.filter(
    (t) => t.status !== TaskStatus.DONE
  );

  let activeWeight = 0;
  let overdueTasks = 0;
  let upcomingDeadlineTasks = 0;

  for (const task of activeTasks) {
    const weight = task.weight ?? DEFAULT_TASK_WEIGHT; // default weight for unweighted tasks
    activeWeight += weight;

    if (task.dueDate) {
      const due = new Date(task.dueDate);
      due.setHours(0, 0, 0, 0);

      if (due < today) {
        overdueTasks++;
      } else if (due <= threeDaysFromNow) {
        upcomingDeadlineTasks++;
      }
    }
  }

  const overduePenalty = overdueTasks * 4;
  const deadlinePressure = upcomingDeadlineTasks * 2;
  const taskCountFactor = activeTasks.length * 0.5;

  const workloadScore = Math.round(
    activeWeight + overduePenalty + deadlinePressure + taskCountFactor
  );

  let workloadLevel: "Low" | "Medium" | "High";
  if (workloadScore < WORKLOAD_LEVEL_MEDIUM_THRESHOLD) {
    workloadLevel = "Low";
  } else if (workloadScore < WORKLOAD_LEVEL_HIGH_THRESHOLD) {
    workloadLevel = "Medium";
  } else {
    workloadLevel = "High";
  }

  return {
    activeTasks: activeTasks.length,
    activeWeight,
    overdueTasks,
    upcomingDeadlineTasks,
    workloadScore,
    workloadLevel,
  };
}

export const getAITools = (
  databases: Databases,
  user: AIUser
) => {
  const checkWorkspaceAccess = async (workspaceId: string) => {
    if (!user?.$id) {
      throw new Error("Unauthorized");
    }

    const member = await getMember({
      databases,
      workspaceId,
      userId: user.$id,
    });

    if (!member) {
      throw new Error("You are not a member of this workspace");
    }

    return member;
  };

  return {
    getMyTasks: tool({
      description: "Get tasks assigned to the currently authenticated user. Use this for \"my tasks\", \"tasks assigned to me\", \"what am I working on\", \"my workload\", \"my overdue tasks\", and similar personal task queries. Never ask the user for their member ID. When the user asks for overdue tasks, set overdue=true.",

      inputSchema: z.object({
        workspaceId: z.string(),
        projectId: z.string().optional(),
        status: z.nativeEnum(TaskStatus).optional(),
        search: z.string().optional(),
        overdue: z.boolean().optional(),
      }),

      execute: async ({
        overdue,
        workspaceId,
        projectId,
        status,
        search,
      }) => {
        try {
          const member = await checkWorkspaceAccess(workspaceId);

          const queries = [
            Query.equal("workspaceId", workspaceId),
            Query.equal("assigneeId", member.$id),
          ];

          if (projectId) {
            queries.push(Query.equal("projectId", projectId));
          }

          if (status) {
            queries.push(Query.equal("status", status));
          }

          if (search) {
            queries.push(Query.search("name", search));
          }

          const tasks = await databases.listDocuments(
            DATABASE_ID,
            TASKS_ID,
            queries
          );

          let resultTasks = tasks.documents as unknown as AITask[];
          if (overdue) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            resultTasks = resultTasks.filter(t => {
              if (t.status === TaskStatus.DONE || !t.dueDate) return false;
              const due = new Date(t.dueDate);
              due.setHours(0, 0, 0, 0);
              return due < today;
            });
          }

          return resultTasks.map((task) => ({
            id: task.$id,
            name: task.name,
            status: task.status,
            dueDate: task.dueDate,
            projectId: task.projectId,
            assigneeId: task.assigneeId,
            description: task.description,
            weight: task.weight,
          }));
        } catch (error: unknown) {
          return {
            error: error instanceof Error ? error.message : "Unable to get tasks",
          };
        }
      },
    }),


    getProjects: tool({
      description: "Get projects in the current workspace. Use this when the user asks about available projects or needs project information.",

      inputSchema: z.object({
        workspaceId: z.string(),
      }),

      execute: async ({ workspaceId }) => {
        try {
          await checkWorkspaceAccess(workspaceId);

          const projects = await databases.listDocuments(
            DATABASE_ID,
            PROJECTS_ID,
            [Query.equal("workspaceId", workspaceId)]
          );

          return (projects.documents as unknown as AIProject[]).map((project) => ({
            id: project.$id,
            name: project.name,
            imageUrl: project.imageUrl,
          }));
        } catch (error: unknown) {
          return {
            error: error instanceof Error ? error.message : "Unable to get projects",
          };
        }
      },
    }),

    getTasks: tool({
      description: "Get tasks from the workspace. Use this for general task queries, project-specific task queries, status filtering, assignee filtering, and task-name searches. If the user asks about their own tasks, use getMyTasks instead.",

      inputSchema: z.object({
        workspaceId: z.string(),
        projectId: z.string().optional(),
        status: z.nativeEnum(TaskStatus).optional(),
        search: z.string().optional(),
        assigneeId: z.string().optional(),
        overdue: z.boolean().optional(),
      }),

      execute: async ({
        overdue,
        workspaceId,
        projectId,
        status,
        search,
        assigneeId,
      }) => {
        try {
          await checkWorkspaceAccess(workspaceId);

          const queries = [
            Query.equal("workspaceId", workspaceId),
          ];

          if (projectId) {
            queries.push(Query.equal("projectId", projectId));
          }

          if (status) {
            queries.push(Query.equal("status", status));
          }

          if (assigneeId) {
            queries.push(Query.equal("assigneeId", assigneeId));
          }

          if (search) {
            queries.push(Query.search("name", search));
          }

          const tasks = await databases.listDocuments(
            DATABASE_ID,
            TASKS_ID,
            queries
          );

          let resultTasks = tasks.documents as unknown as AITask[];
          if (overdue) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            resultTasks = resultTasks.filter(t => {
              if (t.status === TaskStatus.DONE || !t.dueDate) return false;
              const due = new Date(t.dueDate);
              due.setHours(0, 0, 0, 0);
              return due < today;
            });
          }

          return resultTasks.map((task) => ({
            id: task.$id,
            name: task.name,
            status: task.status,
            dueDate: task.dueDate,
            projectId: task.projectId,
            assigneeId: task.assigneeId,
            description: task.description,
            weight: task.weight,
          }));
        } catch (error: unknown) {
          return {
            error: error instanceof Error ? error.message : "Unable to get tasks",
          };
        }
      },
    }),

    getMembers: tool({
      description:
        "Get the members of a workspace. Use this when the user wants to assign a task to someone.",

      inputSchema: z.object({
        workspaceId: z.string(),
      }),

      execute: async ({ workspaceId }) => {
        try {
          await checkWorkspaceAccess(workspaceId);

          const members = await databases.listDocuments(
            DATABASE_ID,
            MEMBERS_ID,
            [Query.equal("workspaceId", workspaceId)]
          );

          return (members.documents as unknown as AIMember[]).map((member) => ({
            id: member.$id,
            userId: member.userId,
            role: member.role,
          }));
        } catch (error: unknown) {
          return {
            error: error instanceof Error ? error.message : "Unable to get members",
          };
        }
      },
    }),

    // ──────────────────────────────────────────────────────
    // NEW TOOL: Get members with computed workload data
    // ──────────────────────────────────────────────────────
    getMembersWithWorkload: tool({
      description:
        "Get workspace members together with their current workload analysis. Returns each member's name, designation/role, active task count, active task weight, overdue count, and a computed workload score. Use this BEFORE calling proposeStoryPlan so you can recommend fair task assignments. Also use this when the user asks about team workload or capacity.",

      inputSchema: z.object({
        workspaceId: z.string(),
      }),

      execute: async ({ workspaceId }) => {
        try {
          await checkWorkspaceAccess(workspaceId);

          const { users } = await createAdminClient();

          // Fetch all workspace members
          const membersResult = await databases.listDocuments(
            DATABASE_ID,
            MEMBERS_ID,
            [Query.equal("workspaceId", workspaceId)]
          );
          const members = membersResult.documents as unknown as AIMember[];

          // Fetch all workspace tasks (non-DONE for workload)
          const tasksResult = await databases.listDocuments(
            DATABASE_ID,
            TASKS_ID,
            [
              Query.equal("workspaceId", workspaceId),
              Query.limit(500),
            ]
          );
          const allTasks = tasksResult.documents as unknown as AITask[];

          // Build per-member workload data
          const memberWorkloads = await Promise.all(
            members.map(async (member) => {
              // Get user display name
              let displayName = "Unknown";
              try {
                const userInfo = await users.get(member.userId);
                displayName = userInfo.name || userInfo.email;
              } catch {
                displayName = member.userId;
              }

              // Filter tasks assigned to this member
              const memberTasks = allTasks.filter(
                (t) => t.assigneeId === member.$id
              );

              const workload = computeWorkloadScore(memberTasks);

              return {
                memberId: member.$id,
                name: displayName,
                role: member.role,
                designation: member.designation || "Unassigned",
                activeTasks: workload.activeTasks,
                activeWeight: workload.activeWeight,
                overdueTasks: workload.overdueTasks,
                upcomingDeadlineTasks: workload.upcomingDeadlineTasks,
                workloadScore: workload.workloadScore,
                workloadLevel: workload.workloadLevel,
              };
            })
          );

          return memberWorkloads;
        } catch (error: unknown) {
          return {
            error:
              error instanceof Error
                ? error.message
                : "Unable to get members with workload",
          };
        }
      },
    }),

    // ──────────────────────────────────────────────────────
    // PROJECT HEALTH & RISK INTELLIGENCE (Task 2)
    // ──────────────────────────────────────────────────────
    getProjectHealth: tool({
      description: `Analyze a project's health, risks, workload, and produce actionable recommendations.
Use this tool when the user asks about:
- project health, project status, project overview, project summary
- whether a project is at risk, why a project is behind
- project risks, what could go wrong, what could delay the project
- deadline risks, which deadlines are at risk
- what the team should prioritize, what to work on today, what to focus on
- project progress, how far along we are, completion status
- whether anyone is overloaded, workload across the team for a project
- comparing project health across projects (call for each project)

The tool returns a full deterministic analysis: health score, metrics, risks, workload, and priority recommendations.
You should then explain the results in natural language, highlighting the most important findings.
Do NOT repeat internal IDs in your response. Use task names and member names only.`,

      inputSchema: z.object({
        workspaceId: z.string().describe("The workspace ID"),
        projectId: z.string().describe("The project ID to analyze"),
      }),

      execute: async ({ workspaceId, projectId }) => {
        try {
          await checkWorkspaceAccess(workspaceId);

          // Verify the project belongs to this workspace
          const project = await databases.getDocument(
            DATABASE_ID,
            PROJECTS_ID,
            projectId,
          );
          if ((project as unknown as { workspaceId: string }).workspaceId !== workspaceId) {
            return { error: "Project not found in this workspace." };
          }

          const { analyzeProjectHealth } = await import("./project-health");
          const result = await analyzeProjectHealth(databases, workspaceId, projectId);
          return result;
        } catch (error: unknown) {
          return {
            error: error instanceof Error ? error.message : "Unable to analyze project health",
          };
        }
      },
    }),

    // ──────────────────────────────────────────────────────
    // EXISTING: Simple story proposal (kept for backward compat)
    // ──────────────────────────────────────────────────────

    proposeStory: tool({
  description:
    "Propose a new software story for the Create Story form. This does not create anything in the database. The user must review and confirm it.",

  inputSchema: z.object({
    title: z.string(),

    description: z.string(),

    projectId: z.string(),

    dueDate: z
      .string()
      .optional()
      .describe(
        "Suggested story due date as an ISO date string. Choose a realistic future date if the user did not specify one."
      ),

    status: z
      .nativeEnum(TaskStatus)
      .optional()
      .describe("Suggested initial story status."),

    assigneeId: z
      .string()
      .optional()
      .describe(
        "Recommended workspace member ID for the story assignee."
      ),

    assigneeName: z
      .string()
      .optional()
      .describe(
        "Human-readable name of the recommended assignee."
      ),

    priority: z
      .number()
      .int()
      .min(1)
      .max(13)
      .optional()
      .describe("Task weight from 1 to 13."),

    acceptanceCriteria: z.array(z.string()),

    subtasks: z.array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        priority: z
          .number()
          .int()
          .min(1)
          .max(13)
          .optional(),
      })
    ),
  }),
}),

    // ──────────────────────────────────────────────────────
    // NEW TOOL: Full story plan with assignment recommendations
    // ──────────────────────────────────────────────────────
    proposeStoryPlan: tool({
      description: `Propose a comprehensive story/task decomposition plan with intelligent assignment recommendations.
Use this when the user asks to:
- Break down a requirement into tasks and assign them
- Create a story with fair work distribution
- Plan implementation work across team members
- Build something and distribute work to the team

IMPORTANT: Before calling this tool, you MUST first call getMembersWithWorkload to get real workload data.
Then use that data to select appropriate assignees.

WORKFLOW:
1. Call getProjects to identify the correct project
2. Call getMembersWithWorkload to get team workload
3. Analyze the requirement and generate subtasks
4. Use workload data + member designations to recommend assignees
5. Call this tool with the complete plan

This tool renders a reviewable UI card. Nothing is created in the database until the user clicks "Confirm & Create".

Rules for assignment:
- Consider member designation (e.g., "Frontend Developer" for UI tasks, "Backend Developer" for API tasks)
- Consider current workload score (prefer members with lower workload)
- Consider role relevance over pure workload balance
- Explain WHY each member was selected
- Never expose internal IDs in assignmentReason or explanation text`,

      inputSchema: z.object({
        story: z.object({
          title: z.string().describe("Story/epic title"),
          description: z.string().describe("Detailed description of the story"),
          projectId: z.string().describe("Project ID from getProjects"),
          projectName: z.string().describe("Human-readable project name"),

          priority: z
            .number()
            .int()
            .min(1)
            .max(13)
            .optional()
            .describe("Story weight from 1 to 13"),

          dueDate: z
            .string()
            .describe(
              "Story deadline as an ISO date string. If the user gives a deadline, plan around it. If no deadline is given, choose a reasonable future deadline based on the estimated implementation effort."
            ),

          suggestedAssigneeId: z
            .string()
            .optional()
            .describe(
              "Member ID of the recommended story owner from getMembersWithWorkload."
            ),

          suggestedAssigneeName: z
            .string()
            .optional()
            .describe("Human-readable name of the recommended story owner."),

          assignmentReason: z
            .string()
            .optional()
            .describe(
              "Human-readable explanation for why this member should own the story. Never include internal IDs."
            ),

          acceptanceCriteria: z
            .array(z.string())
            .describe("List of acceptance criteria"),
        }),

  subtasks: z.array(
  z.object({
    title: z.string().describe("Subtask title"),

    description: z
      .string()
      .optional()
      .describe("Brief description of the subtask"),

    priority: z
      .number()
      .int()
      .min(1)
      .max(13)
      .optional()
      .describe("Subtask weight from 1 to 13"),

    dueDate: z
      .string()
      .describe(
        "Subtask deadline as an ISO date string. It must be on or before the parent story deadline."
      ),

    suggestedAssigneeId: z
      .string()
      .optional()
      .describe("Member ID from getMembersWithWorkload"),

    suggestedAssigneeName: z
      .string()
      .optional()
      .describe("Display name of the suggested assignee"),

    assignmentReason: z
      .string()
      .optional()
      .describe(
        "Human-readable reason for this assignment (no IDs)"
      ),

    dependsOn: z
      .string()
      .optional()
      .describe(
        "Title of another subtask this depends on, if applicable"
      ),
  })
),

        workloadSummary: z.array(
          z.object({
            memberName: z.string(),
            memberId: z.string(),
            designation: z.string(),
            currentWorkload: z
              .string()
              .describe("Current workload level: Low, Medium, or High"),
            currentScore: z.number().describe("Current workload score"),
            proposedNewTasks: z
              .number()
              .describe("Number of new tasks proposed for this member"),
          })
        ),

        explanation: z
          .string()
          .describe(
            "Overall explanation of the plan and assignment rationale. Do not include any internal IDs."
          ),
      }),

      // No execute — this is a UI-only tool. The frontend renders the proposal card.
    }),

    proposeTaskUpdate: tool({
      description:
        "Propose an update to an existing task. This does not modify the database until the user confirms.",

      inputSchema: z.object({
        taskId: z.string(),
        status: z.nativeEnum(TaskStatus).optional(),
        weight: z
          .number()
          .int()
          .min(1)
          .max(13)
          .optional(),
        assigneeId: z.string().optional(),
      }),
    }),
  };
};