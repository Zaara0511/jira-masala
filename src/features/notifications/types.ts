import { Models } from "node-appwrite";

export enum NotificationType {
  TASK_ASSIGNED = "TASK_ASSIGNED",
  TASK_COMMENTED = "TASK_COMMENTED",
  COMMENT_MENTIONED = "COMMENT_MENTIONED",
  COMMENT_REPLIED = "COMMENT_REPLIED",
  TASK_STATUS_CHANGED = "TASK_STATUS_CHANGED",
}

export type Notification = Models.Document & {
  recipientId: string;
  workspaceId: string;
  projectId?: string;
  taskId?: string;
  actorId: string;
  actorName: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  entityName: string;
  isRead: boolean;
};
