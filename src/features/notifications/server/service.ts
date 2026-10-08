import { Databases, ID } from "node-appwrite";
import { NOTIFICATIONS_ID, DATABASE_ID } from "@/config";
import { NotificationType } from "../types";

interface CreateNotificationProps {
  databases: Databases;
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
}

export async function createNotification({
  databases,
  recipientId,
  workspaceId,
  projectId,
  taskId,
  actorId,
  actorName,
  type,
  title,
  message,
  entityType,
  entityId,
  entityName,
}: CreateNotificationProps) {
  try {
    const payload: Record<string, unknown> = {
      recipientId,
      workspaceId,
      actorId,
      actorName,
      type,
      title,
      message,
      entityType,
      entityId,
      entityName,
      isRead: false,
    };

    if (projectId) payload.projectId = projectId;
    if (taskId) payload.taskId = taskId;

    console.log("📦 Notification payload:", {
      recipientId,
      recipientName: recipientId,
      workspaceId,
      projectId,
      taskId,
      actorId,
      actorName,
      type,
    });

    const notification = await databases.createDocument(
      DATABASE_ID,
      NOTIFICATIONS_ID,
      ID.unique(),
      payload
    );

    console.log("✅ Notification created:", notification.$id);
  } catch (error) {
    console.error("Failed to create notification", error);
    throw error;
  }
}
