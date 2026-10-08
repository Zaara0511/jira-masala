"use client";

import { useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import {
  CheckSquare, Folder, Users, Settings,
  Shield, Building, Mail, Activity as ActivityIcon,
  Search,
  MoreVertical,
  X
} from "lucide-react";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetActivities } from "../api/use-get-activities";
import { MemberAvatar } from "@/features/members/components/member-avatar";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DottedSeparator } from "@/components/dotted-separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

const PAGE_SIZE = 20;

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  tasks: <CheckSquare className="size-4 text-blue-500" />,
  projects: <Folder className="size-4 text-amber-500" />,
  members: <Users className="size-4 text-green-500" />,
  settings: <Settings className="size-4 text-neutral-500" />,
  authentication: <Shield className="size-4 text-purple-500" />,
  workspaces: <Building className="size-4 text-indigo-500" />,
  invites: <Mail className="size-4 text-pink-500" />,
  system: <ActivityIcon className="size-4 text-slate-500" />
};

export const ActivityList = () => {
  const workspaceId = useWorkspaceId();

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);

  const { data, isLoading, isError, refetch } = useGetActivities({
    workspaceId,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    eventCategory: categoryFilter === "all" ? null : categoryFilter,
    action: actionFilter === "all" ? null : actionFilter
  });

  const activities = data?.documents || [];
  const total = data?.total || 0;

  // Search filtering happens on client-side for simplicity since there is no server-side search param implemented.
  // In a robust implementation, search should be passed to useGetActivities.
  const filteredActivities = activities.filter((activity: any) => {
    if (!search) return true;
    const lowerSearch = search.toLowerCase();
    return (
      activity.userName?.toLowerCase().includes(lowerSearch) ||
      activity.entityName?.toLowerCase().includes(lowerSearch) ||
      activity.description?.toLowerCase().includes(lowerSearch) ||
      activity.action?.toLowerCase().includes(lowerSearch) ||
      activity.eventCategory?.toLowerCase().includes(lowerSearch)
    );
  });

  const clearFilters = () => {
    setCategoryFilter("all");
    setActionFilter("all");
    setSearch("");
    setPage(0);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return `Today, ${format(date, "hh:mm a")}`;
    if (isYesterday(date)) return `Yesterday, ${format(date, "hh:mm a")}`;
    return format(date, "dd MMM yyyy, hh:mm a");
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isError) {
    return (
      <Card className="w-full h-full border-none shadow-none">
        <CardContent className="flex flex-col items-center justify-center h-64 gap-y-4">
          <p className="text-sm text-muted-foreground">Unable to load activity logs.</p>
          <Button variant="secondary" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-col md:flex-row gap-4 flex-1">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="tasks">Tasks</SelectItem>
              <SelectItem value="projects">Projects</SelectItem>
              <SelectItem value="members">Members</SelectItem>
              <SelectItem value="workspaces">Workspaces</SelectItem>
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="updated">Updated</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
              <SelectItem value="status_changed">Status Changed</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search activity..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {(categoryFilter !== "all" || actionFilter !== "all" || search) && (
            <Button variant="ghost" onClick={clearFilters} className="px-3 text-muted-foreground">
              Clear Filters
            </Button>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      <Card className="w-full border-none shadow-none">
        <CardContent className="p-0">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Date</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Change Summary</TableHead>
                  <TableHead>Changed Object</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredActivities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <ActivityIcon className="size-8 text-neutral-300" />
                        <p className="text-sm font-medium text-neutral-900">No activity has been recorded yet.</p>
                        <p className="text-sm text-neutral-500">Actions performed in this workspace will appear here.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredActivities.map((activity: any) => (
                    <TableRow key={activity.$id}>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {formatDate(activity.$createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-x-2">
                          <MemberAvatar name={activity.userName} className="size-6" />
                          <p className="text-sm font-medium">{activity.userName}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-x-2 capitalize text-sm text-muted-foreground">
                          {CATEGORY_ICONS[activity.eventCategory] || <ActivityIcon className="size-4 text-slate-500" />}
                          {activity.eventCategory}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {activity.description || formatAction(activity.action)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {activity.entityName || "-"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedActivity(activity)}>
                          <MoreVertical className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between py-4">
            <p className="text-sm text-muted-foreground">
              Showing {Math.min((page * PAGE_SIZE) + 1, total)}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} activities
            </p>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= total}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!selectedActivity} onOpenChange={(open) => !open && setSelectedActivity(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Activity Details</SheetTitle>
            <SheetDescription>Detailed information about this event.</SheetDescription>
          </SheetHeader>
          {selectedActivity && (
            <div className="mt-6 flex flex-col space-y-4">
              <div className="grid grid-cols-2 gap-y-4 text-sm">
                <div className="text-muted-foreground font-medium">Event</div>
                <div className="font-medium">{selectedActivity.description || formatAction(selectedActivity.action)}</div>

                <div className="text-muted-foreground font-medium">Category</div>
                <div className="capitalize flex items-center gap-x-2">
                  {CATEGORY_ICONS[selectedActivity.eventCategory] || <ActivityIcon className="size-4" />}
                  {selectedActivity.eventCategory}
                </div>

                <div className="text-muted-foreground font-medium">Performed by</div>
                <div className="flex items-center gap-x-2">
                  <MemberAvatar name={selectedActivity.userName} className="size-5" />
                  {selectedActivity.userName}
                </div>

                <div className="text-muted-foreground font-medium">Date</div>
                <div>{formatDate(selectedActivity.$createdAt)}</div>

                <div className="text-muted-foreground font-medium">Target</div>
                <div>{selectedActivity.entityName || "-"}</div>

                <div className="text-muted-foreground font-medium">Entity Type</div>
                <div className="capitalize">{selectedActivity.entityType}</div>

                <div className="text-muted-foreground font-medium">Entity ID</div>
                <div className="text-xs font-mono bg-neutral-100 p-1 rounded break-all">{selectedActivity.entityId}</div>

                {selectedActivity.metadata && (
                  <>
                    <div className="col-span-2 mt-4">
                      <DottedSeparator className="mb-4" />
                      <div className="text-muted-foreground font-medium mb-2">Additional Metadata</div>
                      <pre className="text-xs bg-neutral-100 p-2 rounded overflow-x-auto">
                        {selectedActivity.metadata}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
