import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Query } from "node-appwrite";

import { sessionMiddleware } from "@/lib/session-middleware";
import { DATABASE_ID, NOTIFICATIONS_ID } from "@/config";
import { Notification } from "../types";

const app = new Hono()
  .get(
    "/",
    sessionMiddleware,
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workspaceId } = c.req.valid("query");

      const notifications = await databases.listDocuments<Notification>(
        DATABASE_ID,
        NOTIFICATIONS_ID,
        [
          Query.equal("workspaceId", workspaceId),
          Query.equal("recipientId", user.$id),
          Query.orderDesc("$createdAt"),
          Query.limit(50),
        ]
      );
      console.log("🔔 Notifications fetched:", {
        userId: user.$id,
        workspaceId,
        count: notifications.total,
        documents: notifications.documents,
      });

      return c.json({ data: notifications });
    }
  )
  .post(
    "/:notificationId/read",
    sessionMiddleware,
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { notificationId } = c.req.param();

      const notification = await databases.getDocument<Notification>(
        DATABASE_ID,
        NOTIFICATIONS_ID,
        notificationId
      );

      if (notification.recipientId !== user.$id) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const updated = await databases.updateDocument<Notification>(
        DATABASE_ID,
        NOTIFICATIONS_ID,
        notificationId,
        {
          isRead: true,
        }
      );

      return c.json({ data: updated });
    }
  )
  .post(
    "/read-all",
    sessionMiddleware,
    zValidator("json", z.object({ workspaceId: z.string() })),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workspaceId } = c.req.valid("json");

      const notifications = await databases.listDocuments<Notification>(
        DATABASE_ID,
        NOTIFICATIONS_ID,
        [
          Query.equal("workspaceId", workspaceId),
          Query.equal("recipientId", user.$id),
          Query.orderDesc("$createdAt"),
          Query.limit(50),
        ]
      );

      const promises = notifications.documents.map((n) =>
        databases.updateDocument(DATABASE_ID, NOTIFICATIONS_ID, n.$id, {
          isRead: true,
        })
      );

      await Promise.all(promises);

      return c.json({ success: true });
    }
  );

export default app;
