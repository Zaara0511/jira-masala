"use client";

import { ActivityList } from "@/features/activities/components/activity-list";

export const ActivityClient = () => {
  return (
    <div className="flex flex-col gap-y-4 w-full h-full p-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Activity Log</h1>
          <p className="text-muted-foreground text-sm">
            Track important changes and actions performed across this workspace.
          </p>
        </div>
      </div>
      <ActivityList />
    </div>
  );
};
