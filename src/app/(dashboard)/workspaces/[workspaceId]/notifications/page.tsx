"use client";

import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { Bell, CheckSquare, MessageSquare, Folder } from "lucide-react";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetNotifications } from "@/features/notifications/api/use-get-notifications";
import { useMarkNotificationRead } from "@/features/notifications/api/use-mark-notification-read";
import { useMarkAllNotificationsRead } from "@/features/notifications/api/use-mark-all-notifications-read";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/page-loader";

const NotificationsPage = () => {
  const workspaceId = useWorkspaceId();
  const router = useRouter();

  const { data: notificationsData, isLoading } = useGetNotifications({ workspaceId });
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllNotificationsRead();

  const notifications = notificationsData?.documents || [];
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const handleNotificationClick = (notification: any) => {
    if (!notification.isRead) {
      markRead({ param: { notificationId: notification.$id } });
    }

    if (notification.entityType === "task" && notification.entityId) {
      router.push(`/workspaces/${workspaceId}/tasks/${notification.entityId}`);
    } else if (notification.entityType === "project" && notification.entityId) {
      router.push(`/workspaces/${workspaceId}/projects/${notification.entityId}`);
    }
  };

  const handleMarkAllRead = () => {
    markAllRead({ json: { workspaceId } });
  };

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="w-full h-full max-w-4xl mx-auto flex flex-col gap-y-4">
      <Card className="border-none shadow-none">
        <CardHeader className="flex flex-row items-center justify-between p-7">
          <CardTitle className="text-xl font-bold flex items-center gap-x-2">
            <Bell className="w-5 h-5" />
            Notifications
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full ml-2">
                {unreadCount} new
              </span>
            )}
          </CardTitle>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={isMarkingAll}
            >
              Mark all as read
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-7 pt-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-neutral-500">
              <Bell className="w-12 h-12 mb-4 opacity-20" />
              <p>You have no notifications in this workspace.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-y-4">
              {notifications.map((notification: any) => {
                const isUnread = !notification.isRead;

                let Icon = Bell;
                if (notification.type === "TASK_ASSIGNED" || notification.type === "TASK_STATUS_CHANGED") Icon = CheckSquare;
                if (notification.type === "TASK_COMMENTED" || notification.type === "COMMENT_MENTIONED") Icon = MessageSquare;
                if (notification.type === "PROJECT_UPDATED") Icon = Folder;

                return (
                  <div
                    key={notification.$id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`flex items-start gap-x-4 p-4 rounded-lg border cursor-pointer transition hover:shadow-sm ${
                      isUnread ? "bg-blue-50/30 border-blue-100" : "bg-white border-neutral-100"
                    }`}
                  >
                    <div className={`p-2 rounded-full ${isUnread ? "bg-blue-100 text-blue-600" : "bg-neutral-100 text-neutral-500"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm ${isUnread ? "font-semibold text-neutral-900" : "font-medium text-neutral-700"}`}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-neutral-400">
                          {formatDistanceToNow(new Date(notification.$createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <p className="text-sm text-neutral-600">
                        {notification.message}
                      </p>
                    </div>
                    {isUnread && (
                      <div className="flex items-center self-center justify-center">
                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationsPage;
