// import { Hono } from "hono";
// import { zValidator } from "@hono/zod-validator";
// import { z } from "zod";
// import { ID, Query } from "node-appwrite";

// import { sessionMiddleware } from "@/lib/session-middleware";
// import { DATABASE_ID, COMMENTS_ID, TASKS_ID } from "@/config";
// import { Comment } from "../types";
// import { createActivity } from "@/features/activities/server/service";
// import { createNotification } from "@/features/notifications/server/service";
// import { NotificationType } from "@/features/notifications/types";

// const app = new Hono()
//   .get(
//     "/",
//     sessionMiddleware,
//     zValidator("query", z.object({ taskId: z.string() })),
//     async (c) => {
//       const databases = c.get("databases");
//       const { taskId } = c.req.valid("query");

//       const comments = await databases.listDocuments<Comment>(
//         DATABASE_ID,
//         COMMENTS_ID,
//         [
//           Query.equal("taskId", taskId),
//           Query.orderDesc("$createdAt"),
//         ]
//       );

//       return c.json({ data: comments });
//     }
//   )
//   .post(
//     "/",
//     sessionMiddleware,
//     zValidator("json", z.object({
//       workspaceId: z.string(),
//       projectId: z.string(),
//       taskId: z.string(),
//       content: z.string().min(1),
//       parentCommentId: z.string().optional(),
//     })),
//     async (c) => {
//       const databases = c.get("databases");
//       const user = c.get("user");
//       const { workspaceId, projectId, taskId, content, parentCommentId } = c.req.valid("json");

//       const comment = await databases.createDocument<Comment>(
//         DATABASE_ID,
//         COMMENTS_ID,
//         ID.unique(),
//         {
//           workspaceId,
//           projectId,
//           taskId,
//           authorId: user.$id,
//           authorName: user.name,
//           content,
//           parentCommentId,
//           isEdited: false,
//         }
//       );

//       // Fetch task to know its assignee
//       try {
//         const task = await databases.getDocument(DATABASE_ID, TASKS_ID, taskId);

//         await createActivity({
//           databases,
//           workspaceId,
//           projectId,
//           userId: user.$id,
//           userName: user.name,
//           eventCategory: "comment",
//           action: "created",
//           entityType: "task",
//           entityId: taskId,
//           entityName: task.name,
//           description: `commented on task`,
//         });

//         if (task.assigneeId && task.assigneeId !== user.$id) {
//           await createNotification({
//             databases,
//             recipientId: task.assigneeId,
//             workspaceId,
//             projectId,
//             taskId,
//             actorId: user.$id,
//             actorName: user.name,
//             type: NotificationType.TASK_COMMENTED,
//             title: "New comment on your task",
//             message: `${user.name} commented on "${task.name}"`,
//             entityType: "task",
//             entityId: taskId,
//             entityName: task.name,
//           });
//         }

//         // Check for mentions @Name
//         const mentions = content.match(/@(\w+\s?\w*)/g);
//         if (mentions) {
//            const names = mentions.map((m: string) => m.substring(1).trim());
//            // Lookup members
//            const workspaceMembers = await databases.listDocuments(
//              DATABASE_ID,
//              // Note: MEMBERS_ID should be imported
//              require("@/config").MEMBERS_ID,
//              [
//                Query.equal("workspaceId", workspaceId),
//                Query.limit(100)
//              ]
//            );

//            // Fetch users to match names since name is on the User object (or we can just query users)
//            // It's easier if we just fetch the member's user object but the admin client is needed
//            const { users } = await require("@/lib/appwrite").createAdminClient();

//            for (const member of workspaceMembers.documents) {
//              try {
//                const u = await users.get(member.userId);
//                if (names.includes(u.name) && u.$id !== user.$id) {
//                  await createNotification({
//                    databases,
//                    recipientId: u.$id,
//                    workspaceId,
//                    projectId,
//                    taskId,
//                    actorId: user.$id,
//                    actorName: user.name,
//                    type: NotificationType.COMMENT_MENTIONED,
//                    title: "You were mentioned",
//                    message: `${user.name} mentioned you in a comment on "${task.name}"`,
//                    entityType: "task",
//                    entityId: taskId,
//                    entityName: task.name,
//                  });
//                }
//              } catch (e) {
//                // ignore
//              }
//            }
//         }

//       } catch (err) {
//         console.error(err);
//       }

//       return c.json({ data: comment });
//     }
//   )
//   .patch(
//     "/:commentId",
//     sessionMiddleware,
//     zValidator("json", z.object({ content: z.string().min(1) })),
//     async (c) => {
//       const databases = c.get("databases");
//       const user = c.get("user");
//       const { commentId } = c.req.param();
//       const { content } = c.req.valid("json");

//       const existingComment = await databases.getDocument<Comment>(
//         DATABASE_ID,
//         COMMENTS_ID,
//         commentId
//       );

//       if (existingComment.authorId !== user.$id) {
//         return c.json({ error: "Unauthorized" }, 401);
//       }

//       const comment = await databases.updateDocument<Comment>(
//         DATABASE_ID,
//         COMMENTS_ID,
//         commentId,
//         {
//           content,
//           isEdited: true,
//         }
//       );

//       try {
//         const task = await databases.getDocument(DATABASE_ID, TASKS_ID, comment.taskId);
//         await createActivity({
//           databases,
//           workspaceId: comment.workspaceId,
//           projectId: comment.projectId,
//           userId: user.$id,
//           userName: user.name,
//           eventCategory: "comment",
//           action: "updated",
//           entityType: "task",
//           entityId: comment.taskId,
//           entityName: task.name,
//           description: `edited a comment on task`,
//         });
//       } catch (err) {
//         console.error(err);
//       }

//       return c.json({ data: comment });
//     }
//   )
//   .delete(
//     "/:commentId",
//     sessionMiddleware,
//     async (c) => {
//       const databases = c.get("databases");
//       const user = c.get("user");
//       const { commentId } = c.req.param();

//       const existingComment = await databases.getDocument<Comment>(
//         DATABASE_ID,
//         COMMENTS_ID,
//         commentId
//       );

//       if (existingComment.authorId !== user.$id) {
//         // Here we could allow workspace admins to delete, but for now we keep it to authors
//         return c.json({ error: "Unauthorized" }, 401);
//       }

//       await databases.deleteDocument(DATABASE_ID, COMMENTS_ID, commentId);

//       try {
//         const task = await databases.getDocument(DATABASE_ID, TASKS_ID, existingComment.taskId);
//         await createActivity({
//           databases,
//           workspaceId: existingComment.workspaceId,
//           projectId: existingComment.projectId,
//           userId: user.$id,
//           userName: user.name,
//           eventCategory: "comment",
//           action: "deleted",
//           entityType: "task",
//           entityId: existingComment.taskId,
//           entityName: task.name,
//           description: `deleted a comment on task`,
//         });
//       } catch (err) {
//         console.error(err);
//       }

//       return c.json({ data: { $id: commentId } });
//     }
//   );

// export default app;
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { ID, Query } from "node-appwrite";

import { sessionMiddleware } from "@/lib/session-middleware";
import {
  DATABASE_ID,
  COMMENTS_ID,
  TASKS_ID,
  MEMBERS_ID,
} from "@/config";
import { createAdminClient } from "@/lib/appwrite";
import { getMember } from "@/features/members/utils";

import { createActivity } from "@/features/activities/server/service";
import {
  EventAction,
  EventCategory,
} from "@/features/activities/types";

import { createNotification } from "@/features/notifications/server/service";
import { NotificationType } from "@/features/notifications/types";

import { Comment } from "../types";

const app = new Hono()

  // ============================================================
  // GET COMMENTS
  // ============================================================
  .get(
    "/",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        taskId: z.string(),
      })
    ),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { taskId } = c.req.valid("query");

      // Get the task first.
      const task = await databases.getDocument(
        DATABASE_ID,
        TASKS_ID,
        taskId
      );

      // Make sure the logged-in user belongs
      // to the task's workspace.
      await getMember({
        databases,
        workspaceId: task.workspaceId,
        userId: user.$id,
      });

      const comments = await databases.listDocuments<Comment>(
        DATABASE_ID,
        COMMENTS_ID,
        [
          Query.equal("taskId", taskId),
          Query.orderAsc("$createdAt"),
          Query.limit(100),
        ]
      );

      return c.json({ data: comments });
    }
  )

  // ============================================================
  // CREATE COMMENT
  // ============================================================
  .post(
    "/",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        taskId: z.string(),
        content: z.string().trim().min(1).max(5000),
        parentCommentId: z.string().optional(),
      })
    ),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");

      const {
        taskId,
        content,
        parentCommentId,
      } = c.req.valid("json");

      // Get task from database.
      const task = await databases.getDocument(
        DATABASE_ID,
        TASKS_ID,
        taskId
      );

      // Verify workspace membership.
      await getMember({
        databases,
        workspaceId: task.workspaceId,
        userId: user.$id,
      });

      // If this is a reply, verify that the parent
      // comment belongs to the same task.
      let parentComment: Comment | null = null;

      if (parentCommentId) {
        parentComment = await databases.getDocument<Comment>(
          DATABASE_ID,
          COMMENTS_ID,
          parentCommentId
        );

        if (
          parentComment.taskId !== taskId ||
          parentComment.workspaceId !== task.workspaceId
        ) {
          return c.json(
            { error: "Invalid parent comment" },
            400
          );
        }
      }

      // Create the comment.
      const comment = await databases.createDocument<Comment>(
        DATABASE_ID,
        COMMENTS_ID,
        ID.unique(),
        {
          workspaceId: task.workspaceId,
          projectId: task.projectId,
          taskId,
          authorId: user.$id,
          authorName: user.name,
          content,
          ...(parentCommentId
            ? { parentCommentId }
            : {}),
          isEdited: false,
        }
      );

      // ========================================================
      // ACTIVITY LOG
      // ========================================================

      await createActivity({
        databases,
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        userId: user.$id,
        userName: user.name,
        eventCategory: EventCategory.TASKS,
        action: EventAction.CREATED,
        entityType: "comment",
        entityId: comment.$id,
        entityName: task.name,
        description: `${user.name} commented on "${task.name}"`,
      });

      // ========================================================
      // NOTIFICATIONS
      // ========================================================

      const recipients = new Set<string>();

      // Notify the task assignee.
      //
      // IMPORTANT:
      // task.assigneeId is a MEMBER document ID,
      // not an Appwrite user ID.
      if (task.assigneeId) {
        try {
          const assigneeMember = await databases.getDocument(
            DATABASE_ID,
            MEMBERS_ID,
            task.assigneeId
          );

          if (
            assigneeMember.userId &&
            assigneeMember.userId !== user.$id
          ) {
            recipients.add(assigneeMember.userId);
          }
        } catch (error) {
          console.error(
            "Failed to find task assignee:",
            error
          );
        }
      }

      // If this is a reply, notify the original commenter.
      if (
        parentComment &&
        parentComment.authorId !== user.$id
      ) {
        recipients.add(parentComment.authorId);
      }

      // Send notifications.
      for (const recipientId of Array.from(recipients)) {
        const isReply =
          parentComment?.authorId === recipientId;

        await createNotification({
          databases,
          recipientId,
          workspaceId: task.workspaceId,
          projectId: task.projectId,
          taskId,
          actorId: user.$id,
          actorName: user.name,
          type: isReply
            ? NotificationType.COMMENT_REPLIED
            : NotificationType.TASK_COMMENTED,
          title: isReply
            ? "New reply to your comment"
            : "New comment on your task",
          message: isReply
            ? `${user.name} replied to your comment on "${task.name}"`
            : `${user.name} commented on "${task.name}"`,
          entityType: "comment",
          entityId: comment.$id,
          entityName: task.name,
        });
      }

      // ========================================================
      // @MENTIONS
      // ========================================================

      const mentions = content.match(
        /@([A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)*)/g
      );

      if (mentions) {
        const mentionedNames = mentions.map((mention) =>
          mention.substring(1).trim().toLowerCase()
        );

        try {
          const workspaceMembers =
            await databases.listDocuments(
              DATABASE_ID,
              MEMBERS_ID,
              [
                Query.equal(
                  "workspaceId",
                  task.workspaceId
                ),
                Query.limit(100),
              ]
            );

          const { users } = await createAdminClient();

          for (const member of workspaceMembers.documents) {
            try {
              const mentionedUser = await users.get(
                member.userId
              );

              if (
                mentionedUser.$id === user.$id ||
                !mentionedUser.name
              ) {
                continue;
              }

              if (
                mentionedNames.includes(
                  mentionedUser.name.toLowerCase()
                )
              ) {
                await createNotification({
                  databases,
                  recipientId: mentionedUser.$id,
                  workspaceId: task.workspaceId,
                  projectId: task.projectId,
                  taskId,
                  actorId: user.$id,
                  actorName: user.name,
                  type: NotificationType.COMMENT_MENTIONED,
                  title: "You were mentioned",
                  message: `${user.name} mentioned you in a comment on "${task.name}"`,
                  entityType: "comment",
                  entityId: comment.$id,
                  entityName: task.name,
                });
              }
            } catch {
              // Ignore users that cannot be resolved.
            }
          }
        } catch (error) {
          console.error(
            "Failed to process mentions:",
            error
          );
        }
      }

      return c.json({ data: comment }, 200);
    }
  )

  // ============================================================
  // UPDATE COMMENT
  // ============================================================
  .patch(
    "/:commentId",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        content: z.string().trim().min(1).max(5000),
      })
    ),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { commentId } = c.req.param();
      const { content } = c.req.valid("json");

      const existingComment =
        await databases.getDocument<Comment>(
          DATABASE_ID,
          COMMENTS_ID,
          commentId
        );

      // Only the author can edit.
      if (existingComment.authorId !== user.$id) {
        return c.json(
          { error: "Unauthorized" },
          401
        );
      }

      // Verify workspace membership.
      await getMember({
        databases,
        workspaceId: existingComment.workspaceId,
        userId: user.$id,
      });

      const task = await databases.getDocument(
        DATABASE_ID,
        TASKS_ID,
        existingComment.taskId
      );

      const comment =
        await databases.updateDocument<Comment>(
          DATABASE_ID,
          COMMENTS_ID,
          commentId,
          {
            content,
            isEdited: true,
          }
        );

      await createActivity({
        databases,
        workspaceId: existingComment.workspaceId,
        projectId: existingComment.projectId,
        userId: user.$id,
        userName: user.name,
        eventCategory: EventCategory.TASKS,
        action: EventAction.UPDATED,
        entityType: "comment",
        entityId: comment.$id,
        entityName: task.name,
        description: `${user.name} edited a comment on "${task.name}"`,
      });

      return c.json({ data: comment }, 200);
    }
  )

  // ============================================================
  // DELETE COMMENT
  // ============================================================
  .delete(
    "/:commentId",
    sessionMiddleware,
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { commentId } = c.req.param();

      const existingComment =
        await databases.getDocument<Comment>(
          DATABASE_ID,
          COMMENTS_ID,
          commentId
        );

      // Only the author can delete.
      if (existingComment.authorId !== user.$id) {
        return c.json(
          { error: "Unauthorized" },
          401
        );
      }

      // Verify workspace membership.
      await getMember({
        databases,
        workspaceId: existingComment.workspaceId,
        userId: user.$id,
      });

      const task = await databases.getDocument(
        DATABASE_ID,
        TASKS_ID,
        existingComment.taskId
      );

      await databases.deleteDocument(
        DATABASE_ID,
        COMMENTS_ID,
        commentId
      );

      await createActivity({
        databases,
        workspaceId: existingComment.workspaceId,
        projectId: existingComment.projectId,
        userId: user.$id,
        userName: user.name,
        eventCategory: EventCategory.TASKS,
        action: EventAction.DELETED,
        entityType: "comment",
        entityId: commentId,
        entityName: task.name,
        description: `${user.name} deleted a comment on "${task.name}"`,
      });

      return c.json(
        {
          data: {
            $id: commentId,
          },
        },
        200
      );
    }
  );

export default app;