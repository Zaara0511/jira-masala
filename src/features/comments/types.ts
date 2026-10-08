import { Models } from "node-appwrite";

export type Comment = Models.Document & {
  workspaceId: string;
  projectId?: string;
  taskId: string;
  authorId: string;
  authorName: string;
  content: string;
  parentCommentId?: string;
  isEdited: boolean;
};