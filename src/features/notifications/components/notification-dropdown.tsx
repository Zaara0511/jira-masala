"use client";

import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetNotifications } from "../api/use-get-notifications";
import { useMarkNotificationRead } from "../api/use-mark-notification-read";
import { useMarkAllNotificationsRead } from "../api/use-mark-all-notifications-read";
import { Notification } from "../types";

import {
   DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";


export const NotificationDropdown = () => {
  const workspaceId = useWorkspaceId();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: notificationsData } = useGetNotifications({ workspaceId });
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllNotificationsRead();

  const notifications = notificationsData?.documents || [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

const handleNotificationClick = (notification: Notification) => {
  // Mark notification as read
  if (!notification.isRead) {
    markRead(
      { param: { notificationId: notification.$id } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ["notifications", workspaceId],
          });
        },
      }
    );
  }

  // Open the related task/story
  if (notification.taskId) {
    router.push(
      `/workspaces/${workspaceId}/tasks/${notification.taskId}`
    );
    return;
  }

  // Open the related project
  if (
    notification.entityType === "project" &&
    notification.entityId
  ) {
    router.push(
      `/workspaces/${workspaceId}/projects/${notification.entityId}`
    );
  }
};

 const handleMarkAllRead = (e: React.MouseEvent) => {
  e.stopPropagation();

  markAllRead(
    { json: { workspaceId } },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["notifications", workspaceId],
        });
      },
    }
  );
};

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative outline-none">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm">Notifications</p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-auto p-0 text-muted-foreground"
              onClick={handleMarkAllRead}
              disabled={isMarkingAll}
            >
              Mark all as read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
              <Bell className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((notification) => (
                <div
                  key={notification.$id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`flex flex-col gap-1 p-4 cursor-pointer hover:bg-neutral-100 transition border-b last:border-0 ${!notification.isRead ? "bg-blue-50/50" : ""
                    }`}
                >
                  <div className="flex items-start justify-between gap-x-2">
                    <p className={`text-sm ${!notification.isRead ? "font-semibold text-blue-950" : "text-neutral-700"}`}>
                      {notification.title}
                    </p>
                    {!notification.isRead && (
                      <span className="h-2 w-2 mt-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-[10px] text-neutral-400 mt-1">
                    {formatDistanceToNow(new Date(notification.$createdAt), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
