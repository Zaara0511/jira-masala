import { Databases, ID } from "node-appwrite";
import { ACTIVITIES_ID, DATABASE_ID } from "@/config";
import { EventCategory, EventAction } from "../types";

interface CreateActivityProps {
  databases: Databases;
  workspaceId: string;
  projectId?: string;
  userId: string;
  userName: string;
  userEmail?: string;
  eventCategory: EventCategory | string;
  action: EventAction | string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  description?: string;
  metadata?: string;
}

export async function createActivity({
  databases,
  workspaceId,
  projectId,
  userId,
  userName,
  userEmail,
  eventCategory,
  action,
  entityType,
  entityId,
  entityName,
  description,
  metadata
}: CreateActivityProps) {
  try {
    const payload: Record<string, unknown> = {
      workspaceId,
      userId,
      userName,
      eventCategory,
      action,
      entityType,
    };

    if (projectId) payload.projectId = projectId;
    if (userEmail) payload.userEmail = userEmail;
    if (entityId) payload.entityId = entityId;
    if (entityName) payload.entityName = entityName;
    if (description) payload.description = description;
    if (metadata) payload.metadata = metadata;

    await databases.createDocument(
      DATABASE_ID,
      ACTIVITIES_ID,
      ID.unique(),
      payload
    );
  } catch (error) {
    console.error("Failed to create activity log", error);
  }
}
