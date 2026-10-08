import { Models } from "node-appwrite";

export enum EventCategory {
  AUTHENTICATION = "authentication",
  WORKSPACES = "workspaces",
  PROJECTS = "projects",
  TASKS = "tasks",
  MEMBERS = "members",
  SETTINGS = "settings",
  INVITES = "invites",
  SYSTEM = "system"
}

export enum EventAction {
  CREATED = "created",
  UPDATED = "updated",
  DELETED = "deleted",
  ASSIGNED = "assigned",
  UNASSIGNED = "unassigned",
  STATUS_CHANGED = "status_changed",
  PRIORITY_CHANGED = "priority_changed",
  ROLE_CHANGED = "role_changed",
  INVITED = "invited",
  REMOVED = "removed",
  ARCHIVED = "archived",
  RESTORED = "restored",
  LOGIN = "login",
  LOGOUT = "logout"
}

export type Activity = Models.Document & {
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
};
