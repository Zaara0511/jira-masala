import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckSquare } from "lucide-react";
import { useCreateTask } from "@/features/tasks/api/use-create-task";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { TaskStatus } from "@/features/tasks/types";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface TaskProposal {
  title: string;
  description: string;
  projectId: string;
  priority?: number;
  acceptanceCriteria: string[];
  subtasks: { title: string; description?: string; priority?: number }[];
}

interface Props {
  proposal: TaskProposal;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TaskGenerationPreview = ({ proposal, onConfirm, onCancel }: Props) => {
  const workspaceId = useWorkspaceId();
  const { mutate: createTask, isPending } = useCreateTask();
  const { data: members } = useGetMembers({ workspaceId });
  const [assigneeId, setAssigneeId] = useState<string>("");

  const handleCreate = () => {
    if (!assigneeId) return;

    createTask({
      json: {
        name: proposal.title,
        description: proposal.description + "\n\nAcceptance Criteria:\n" + proposal.acceptanceCriteria.map(c => "- " + c).join("\n"),
        projectId: proposal.projectId,
        workspaceId,
        status: TaskStatus.BACKLOG,
        dueDate: new Date(),
        weight: proposal.priority,
        assigneeId: assigneeId,
      }
    }, {
      onSuccess: () => {
        onConfirm();
      }
    });
  };

  return (
    <Card className="w-full bg-white dark:bg-slate-900 border shadow-sm">
      <CardHeader className="p-3 pb-2 border-b">
        <CardTitle className="text-sm flex items-center gap-2">
          AI Generated Story
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 text-xs flex flex-col gap-2 text-slate-800 dark:text-slate-200">
        <div>
          <span className="font-semibold block">Title</span>
          {proposal.title}
        </div>
        <div>
          <span className="font-semibold block">Acceptance Criteria</span>
          <ul className="list-disc pl-4 opacity-80">
            {proposal.acceptanceCriteria.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
        {proposal.subtasks && proposal.subtasks.length > 0 && (
          <div>
            <span className="font-semibold block flex items-center gap-1">
               <CheckSquare className="w-3 h-3"/> Suggested Subtasks: {proposal.subtasks.length}
            </span>
          </div>
        )}
        <div className="pt-2">
          <span className="font-semibold block mb-1">Assign To</span>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select an assignee" />
            </SelectTrigger>
            <SelectContent>
              {members?.documents.map((member: { $id: string, name: string }) => (
                <SelectItem key={member.$id} value={member.$id}>
                  <div className="flex items-center gap-x-2">
                    <MemberAvatar className="size-5" name={member.name} />
                    {member.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
      <CardFooter className="p-2 border-t flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button size="sm" onClick={handleCreate} disabled={isPending || !assigneeId}>
          {isPending ? "Creating..." : "Create Story"}
        </Button>
      </CardFooter>
    </Card>
  );
};
