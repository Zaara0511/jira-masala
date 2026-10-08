import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { Query } from "node-appwrite";

import { sessionMiddleware } from "@/lib/session-middleware";
import { getMember } from "@/features/members/utils";
import { DATABASE_ID, ACTIVITIES_ID } from "@/config";
import { Activity } from "../types";

const app = new Hono()
  .get(
    "/",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workspaceId: z.string(),
        projectId: z.string().nullish(),
        userId: z.string().nullish(),
        eventCategory: z.string().nullish(),
        action: z.string().nullish(),
        limit: z.coerce.number().optional().default(20),
        offset: z.coerce.number().optional().default(0),
      })
    ),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");

      const {
        workspaceId,
        projectId,
        userId,
        eventCategory,
        action,
        limit,
        offset
      } = c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const queries = [
        Query.equal("workspaceId", workspaceId),
        Query.orderDesc("$createdAt"),
        Query.limit(limit),
        Query.offset(offset)
      ];

      if (projectId) queries.push(Query.equal("projectId", projectId));
      if (userId) queries.push(Query.equal("userId", userId));
      if (eventCategory) queries.push(Query.equal("eventCategory", eventCategory));
      if (action) queries.push(Query.equal("action", action));

      try {
        const activities = await databases.listDocuments<Activity>(
          DATABASE_ID,
          ACTIVITIES_ID,
          queries
        );

        return c.json({ data: activities });
      } catch (error) {
        console.error("Failed to list activities", error);
        return c.json({ data: { documents: [], total: 0 } });
      }
    }
  );

export default app;
