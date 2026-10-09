import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Query } from "node-appwrite";

import { sessionMiddleware } from "@/lib/session-middleware";
import { DATABASE_ID, TASKS_ID, PROJECTS_ID, MEMBERS_ID, COMMENTS_ID } from "@/config";
import { Task } from "@/features/tasks/types";
import { Project } from "@/features/projects/types";
import { Comment } from "@/features/comments/types";
import { SearchResult } from "../types";

const app = new Hono()
  .get(
    "/",
    sessionMiddleware,
    zValidator("query", z.object({
      workspaceId: z.string(),
      query: z.string().min(1),
    })),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workspaceId, query } = c.req.valid("query");

      // Verify member is in the workspace
      const members = await databases.listDocuments(
        DATABASE_ID,
        MEMBERS_ID,
        [
          Query.equal("workspaceId", workspaceId),
          Query.equal("userId", user.$id)
        ]
      );

      if (members.total === 0) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const results: SearchResult[] = [];

      try {
        // Search tasks
        const tasks = await databases.listDocuments<Task>(
          DATABASE_ID,
          TASKS_ID,
          [
            Query.equal("workspaceId", workspaceId),
            Query.search("name", query),
            Query.limit(5)
          ]
        );
        tasks.documents.forEach(t => {
          results.push({ type: "task", id: t.$id, title: t.name, projectId: t.projectId });
        });

        // Search projects
        const projects = await databases.listDocuments<Project>(
          DATABASE_ID,
          PROJECTS_ID,
          [
            Query.equal("workspaceId", workspaceId),
            Query.search("name", query),
            Query.limit(5)
          ]
        );
        projects.documents.forEach(p => {
          results.push({ type: "project", id: p.$id, title: p.name });
        });

        // Search comments (only if query is long enough to avoid huge scans)
        if (query.length >= 3) {
          const comments = await databases.listDocuments<Comment>(
            DATABASE_ID,
            COMMENTS_ID,
            [
              Query.equal("workspaceId", workspaceId),
              Query.search("content", query),
              Query.limit(5)
            ]
          );
          comments.documents.forEach(com => {
            results.push({ type: "comment", id: com.$id, title: com.content, taskId: com.taskId });
          });
        }
      } catch (err) {
        console.error("Search error:", err);
      }

      return c.json({ data: results });
    }
  );

export default app;
