import { FolderIcon, ListChecksIcon, ScaleIcon, UserIcon } from "lucide-react";

import { useGetMembers } from "@/features/members/api/use-get-members";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { DatePicker } from "@/components/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { TaskStatus } from "../types";
import { useTaskFilters } from "../hooks/use-task-filters";

interface DataFiltersProps {
  hideProjectFilter?: boolean;
};

export const DataFilters = ({ hideProjectFilter }: DataFiltersProps) => {
  const workspaceId = useWorkspaceId();

  const { data: projects, isLoading: isLoadingProjects } = useGetProjects({ workspaceId });
  const { data: members, isLoading: isLoadingMembers } = useGetMembers({ workspaceId });

  const isLoading = isLoadingProjects || isLoadingMembers;

  const projectOptions = projects?.documents.map((project) => ({
    value: project.$id,
    label: project.name,
  }));

  const memberOptions = members?.documents.map((member) => ({
    value: member.$id,
    label: member.designation ? `${member.name} (${member.designation})` : member.name,
  }));

  const [{
    status,
    assigneeId,
    projectId,
    dueDate,
    weight,
  }, setFilters] = useTaskFilters();

  const onStatusChange = (value: string) => {
    setFilters({ status: value === "all" ? null : value as TaskStatus });
  };

  const onAssigneeChange = (value: string) => {
    setFilters({ assigneeId: value === "all" ? null : value as string });
  };

  const onProjectChange = (value: string) => {
    setFilters({ projectId: value === "all" ? null : value as string });
  };

  const onWeightChange = (value: string) => {
    setFilters({ weight: value === "all" ? null : value });
  };

  if (isLoading) return null;


  return (
    <div className="flex flex-col lg:flex-row gap-2">
      <Select
        defaultValue={status ?? undefined}
        onValueChange={(value) => onStatusChange(value)}
      >
        <SelectTrigger className="w-full lg:w-auto h-8">
          <div className="flex items-center pr-2">
            <ListChecksIcon className="size-4 mr-2" />
            <SelectValue placeholder="All statuses" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectSeparator />
          <SelectItem value={TaskStatus.BACKLOG}>Backlog</SelectItem>
          <SelectItem value={TaskStatus.IN_PROGRESS}>In Progress</SelectItem>
          <SelectItem value={TaskStatus.IN_REVIEW}>In Review</SelectItem>
          <SelectItem value={TaskStatus.TODO}>Todo</SelectItem>
          <SelectItem value={TaskStatus.DONE}>Done</SelectItem>
        </SelectContent>
      </Select>
      <Select
        defaultValue={assigneeId ?? undefined}
        onValueChange={(value) => onAssigneeChange(value)}
      >
        <SelectTrigger className="w-full lg:w-auto h-8">
          <div className="flex items-center pr-2">
            <UserIcon className="size-4 mr-2" />
            <SelectValue placeholder="All assignees" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All assignees</SelectItem>
          <SelectSeparator />
          {memberOptions?.map((member) => (
            <SelectItem key={member.value} value={member.value}>
              {member.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!hideProjectFilter && (
        <Select
          defaultValue={projectId ?? undefined}
          onValueChange={(value) => onProjectChange(value)}
        >
          <SelectTrigger className="w-full lg:w-auto h-8">
            <div className="flex items-center pr-2">
              <FolderIcon className="size-4 mr-2" />
              <SelectValue placeholder="All projects" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            <SelectSeparator />
            {projectOptions?.map((project) => (
              <SelectItem key={project.value} value={project.value}>
                {project.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select
        defaultValue={weight ?? undefined}
        onValueChange={(value) => onWeightChange(value)}
      >
        <SelectTrigger className="w-full lg:w-auto h-8">
          <div className="flex items-center pr-2">
            <ScaleIcon className="size-4 mr-2" />
            <SelectValue placeholder="All weights" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All weights</SelectItem>
          <SelectSeparator />
          <SelectItem value="5">
            <div className="flex items-center gap-x-2">
              <span className="size-2 rounded-full bg-red-500" />
              <span>5 · Critical</span>
            </div>
          </SelectItem>
          <SelectItem value="4">
            <div className="flex items-center gap-x-2">
              <span className="size-2 rounded-full bg-orange-500" />
              <span>4 · High</span>
            </div>
          </SelectItem>
          <SelectItem value="3">
            <div className="flex items-center gap-x-2">
              <span className="size-2 rounded-full bg-amber-500" />
              <span>3 · Medium</span>
            </div>
          </SelectItem>
          <SelectItem value="2">
            <div className="flex items-center gap-x-2">
              <span className="size-2 rounded-full bg-blue-500" />
              <span>2 · Low</span>
            </div>
          </SelectItem>
          <SelectItem value="1">
            <div className="flex items-center gap-x-2">
              <span className="size-2 rounded-full bg-slate-500" />
              <span>1 · Very Low</span>
            </div>
          </SelectItem>
          <SelectSeparator />
          <SelectItem value="unweighted">Unweighted</SelectItem>
        </SelectContent>
      </Select>
      <DatePicker
        placeholder="Due date"
        className="h-8 w-full lg:w-auto"
        value={dueDate ? new Date(dueDate) : undefined}
        onChange={(date) => {
          setFilters({ dueDate: date ? date.toISOString() : null })
        }}
      />
    </div>
  );
};

