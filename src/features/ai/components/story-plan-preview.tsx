"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckSquare,
  User,
  ArrowRight,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  BarChart3,
  ListChecks,
  RefreshCw,
} from "lucide-react";
import { useCreateTask } from "@/features/tasks/api/use-create-task";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { TaskStatus } from "@/features/tasks/types";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────

export interface StoryPlanSubtask {
  title: string;
  description?: string;
  priority?: number;
  dueDate: string;
  suggestedAssigneeId?: string;
  suggestedAssigneeName?: string;
  assignmentReason?: string;
  dependsOn?: string;
}

export interface StoryPlanWorkloadEntry {
  memberName: string;
  memberId: string;
  designation: string;
  currentWorkload: string;
  currentScore: number;
  proposedNewTasks: number;
}

export interface StoryPlanProposal {
  story: {
    title: string;
    description: string;
    projectId: string;
    projectName: string;
    priority?: number;
    acceptanceCriteria: string[];
    dueDate: string;
    suggestedAssigneeId?: string;
    suggestedAssigneeName?: string;
    assignmentReason?: string;
  };
  subtasks: StoryPlanSubtask[];
  workloadSummary: StoryPlanWorkloadEntry[];
  explanation: string;
}

// ─── Helpers ─────────────────────────────────────────────

const weightLabel = (w?: number): string => {
  if (!w) return "";
  if (w <= 2) return "Low";
  if (w <= 4) return "Medium";
  if (w <= 8) return "High";
  return "Critical";
};

const workloadBadgeColor = (level: string) => {
  switch (level) {
    case "Low":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    case "Medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
    case "High":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
};

// ─── Component ───────────────────────────────────────────

interface Props {
  proposal: StoryPlanProposal;
  onRegenerate?: () => void;
}

export const StoryPlanPreview = ({ proposal, onRegenerate }: Props) => {
  const workspaceId = useWorkspaceId();
  const { mutate: createTask, isPending } = useCreateTask();
  const [isCreating, setIsCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const [totalToCreate, setTotalToCreate] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(true);
  const [showWorkload, setShowWorkload] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { story, subtasks, workloadSummary, explanation } = proposal;

  // ── Confirm & Create ──────────────────────────────────
  const handleConfirmCreate = async () => {
    setError(null);
    setIsCreating(true);
    const total = 1 + subtasks.length; // parent story + subtasks
    setTotalToCreate(total);
    setCreatedCount(0);

    // Create parent story first
    createTask(
      {
        json: {
          name: story.title,
          description:
            story.description +
            (story.acceptanceCriteria.length > 0
              ? "\n\nAcceptance Criteria:\n" +
              story.acceptanceCriteria.map((c) => "- " + c).join("\n")
              : ""),
          projectId: story.projectId,
          workspaceId,
          status: TaskStatus.BACKLOG,
          dueDate: new Date(story.dueDate),
          weight: story.priority,
          assigneeId:
            story.suggestedAssigneeId ||
            workloadSummary.find((member) => member.proposedNewTasks > 0)?.memberId ||
            workloadSummary[0]?.memberId ||
            "",
        },
      },
      {
        onSuccess: () => {
          setCreatedCount(1);
          // Now create all subtasks sequentially
          createSubtasksSequentially(0);
        },
        onError: (err) => {
          setError(
            `Failed to create parent story: ${err.message || "Unknown error"}`
          );
          setIsCreating(false);
        },
      }
    );
  };

  const createSubtasksSequentially = (index: number) => {
    if (index >= subtasks.length) {
      setIsDone(true);
      setIsCreating(false);
      toast.success(
        `Created story "${story.title}" with ${subtasks.length} subtask(s)`
      );
      return;
    }

    const subtask = subtasks[index];
    createTask(
      {
        json: {
          name: subtask.title,
          description: subtask.description || "",
          projectId: story.projectId,
          workspaceId,
          status: TaskStatus.BACKLOG,
          dueDate: new Date(subtask.dueDate),
          weight: subtask.priority,
          assigneeId:
            subtask.suggestedAssigneeId ||
            workloadSummary.find((member) => member.proposedNewTasks > 0)?.memberId ||
            workloadSummary[0]?.memberId ||
            "",
        },
      },
      {
        onSuccess: () => {
          setCreatedCount((prev) => prev + 1);
          createSubtasksSequentially(index + 1);
        },
        onError: (err) => {
          setError(
            `Failed to create subtask "${subtask.title}": ${err.message || "Unknown error"}`
          );
          setIsCreating(false);
        },
      }
    );
  };

  // ── Already created ───────────────────────────────────
  if (isDone) {
    return (
      <Card className="w-full bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 shadow-sm">
        <CardContent className="p-4 text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
          <CheckSquare className="h-4 w-4" />
          <span>
            <strong>{story.title}</strong> and {subtasks.length} subtask(s)
            created successfully!
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-white dark:bg-slate-900 border shadow-sm overflow-hidden">
      {/* ── Header ─────────────────────────────────────── */}
      <CardHeader className="p-4 pb-3 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
        <CardTitle className="text-sm flex items-center gap-2 font-semibold">
          <ListChecks className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          AI Story Plan
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Review the plan below. Nothing is created until you confirm.
        </p>
      </CardHeader>

      <CardContent className="p-4 text-xs flex flex-col gap-4">
        {/* ── Story Details ────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">{story.title}</span>
            {story.priority && (
              <Badge variant="outline" className="text-[10px]">
                Weight: {story.priority} ({weightLabel(story.priority)})
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground leading-relaxed">
            {story.description}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            <Badge variant="secondary" className="text-[10px]">
              {story.projectName}
            </Badge>
            {story.dueDate && (
              <span>Due: {new Date(story.dueDate).toLocaleDateString()}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <User className="h-3 w-3 text-blue-500" />
            <span className="font-medium">
              Owner: {story.suggestedAssigneeName || "Auto-assigned based on workload"}
            </span>
          </div>
          {story.assignmentReason && (
            <p className="text-[10px] text-muted-foreground italic pl-4">
              {story.assignmentReason}
            </p>
          )}
        </div>

        {/* ── Acceptance Criteria ──────────────────────── */}
        {story.acceptanceCriteria.length > 0 && (
          <div>
            <span className="font-semibold block mb-1">
              Acceptance Criteria
            </span>
            <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
              {story.acceptanceCriteria.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Subtasks ─────────────────────────────────── */}
        <div>
          <button
            onClick={() => setShowSubtasks(!showSubtasks)}
            className="font-semibold flex items-center gap-1.5 mb-2 hover:text-blue-600 transition-colors w-full text-left"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Subtasks ({subtasks.length})
            {showSubtasks ? (
              <ChevronUp className="h-3 w-3 ml-auto" />
            ) : (
              <ChevronDown className="h-3 w-3 ml-auto" />
            )}
          </button>

          {showSubtasks && (
            <div className="space-y-2">
              {subtasks.map((subtask, i) => (
                <div
                  key={i}
                  className="border rounded-lg p-3 bg-muted/30 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {i + 1}. {subtask.title}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {subtask.dueDate && (
                        <span className="text-[10px] text-muted-foreground">
                          Due: {new Date(subtask.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      {subtask.priority && (
                        <Badge
                          variant="outline"
                          className="text-[10px] shrink-0"
                        >
                          W:{subtask.priority}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {subtask.description && (
                    <p className="text-muted-foreground text-[11px]">
                      {subtask.description}
                    </p>
                  )}

                  {subtask.suggestedAssigneeName && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <User className="h-3 w-3 text-blue-500" />
                      <span className="font-medium">
                        {subtask.suggestedAssigneeName}
                      </span>
                    </div>
                  )}

                  {subtask.assignmentReason && (
                    <p className="text-[10px] text-muted-foreground italic pl-4">
                      {subtask.assignmentReason}
                    </p>
                  )}

                  {subtask.dependsOn && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                      <ArrowRight className="h-2.5 w-2.5" />
                      Depends on: {subtask.dependsOn}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Team Workload ────────────────────────────── */}
        {workloadSummary.length > 0 && (
          <div>
            <button
              onClick={() => setShowWorkload(!showWorkload)}
              className="font-semibold flex items-center gap-1.5 mb-2 hover:text-blue-600 transition-colors w-full text-left"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Team Workload
              {showWorkload ? (
                <ChevronUp className="h-3 w-3 ml-auto" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-auto" />
              )}
            </button>

            {showWorkload && (
              <div className="space-y-1.5">
                {workloadSummary.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between border rounded-md p-2 bg-muted/20"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-[11px]">
                        {entry.memberName}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {entry.designation}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`text-[10px] ${workloadBadgeColor(entry.currentWorkload)}`}
                      >
                        {entry.currentWorkload}
                      </Badge>
                      {entry.proposedNewTasks > 0 && (
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                          +{entry.proposedNewTasks} new
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Explanation ──────────────────────────────── */}
        {explanation && (
          <div className="border-t pt-3">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {explanation}
            </p>
          </div>
        )}

        {/* ── Progress ─────────────────────────────────── */}
        {isCreating && (
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-[11px]">
              Creating {createdCount}/{totalToCreate}...
            </span>
          </div>
        )}

        {/* ── Error ────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-2 text-destructive text-[11px] p-2 bg-destructive/10 rounded border border-destructive/20">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}
      </CardContent>

      {/* ── Actions ──────────────────────────────────── */}
      <CardFooter className="p-3 border-t flex justify-end gap-2 bg-muted/10">
        {onRegenerate && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onRegenerate}
            disabled={isCreating || isPending}
            className="text-xs gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Regenerate
          </Button>
        )}
        <Button
          size="sm"
          variant="primary"
          onClick={handleConfirmCreate}
          disabled={isCreating || isPending}
          className="text-xs gap-1"
        >
          {isCreating ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <CheckSquare className="h-3 w-3" />
              Confirm & Create
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};
