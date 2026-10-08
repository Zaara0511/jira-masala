import { z } from "zod";
import { Hono } from "hono";
import { ID, Query } from "node-appwrite";
import { zValidator } from "@hono/zod-validator";
import { createActivity } from "@/features/activities/server/service";
import { EventCategory, EventAction } from "@/features/activities/types";
import { createNotification } from "@/features/notifications/server/service";
import { NotificationType } from "@/features/notifications/types";

import { getMember } from "@/features/members/utils";
import { Project } from "@/features/projects/types";

import { createAdminClient } from "@/lib/appwrite";
import { sessionMiddleware } from "@/lib/session-middleware";
import { DATABASE_ID, MEMBERS_ID, PROJECTS_ID, TASKS_ID } from "@/config";

import { Task, TaskStatus } from "../types";
import { createTaskSchema } from "../schemas";

const app = new Hono()
  .delete(
    "/:taskId",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { taskId } = c.req.param();

      const task = await databases.getDocument<Task>(
        DATABASE_ID,
        TASKS_ID,
        taskId,
      );

      const member = await getMember({
        databases,
        workspaceId: task.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      await databases.deleteDocument(
        DATABASE_ID,
        TASKS_ID,
        taskId,
      );

      await createActivity({
        databases,
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        userId: user.$id,
        userName: user.name,
        userEmail: user.email,
        eventCategory: EventCategory.TASKS,
        action: EventAction.DELETED,
        entityType: "task",
        entityId: task.$id,
        entityName: task.name,
        description: "Task deleted"
      });

      return c.json({ data: { $id: task.$id } });
    }
  )
  .get(
    "/",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workspaceId: z.string(),
        projectId: z.string().nullish(),
        assigneeId: z.string().nullish(),
        status: z.nativeEnum(TaskStatus).nullish(),
        search: z.string().nullish(),
        dueDate: z.string().nullish(),
        weight: z.string().nullish(),
      })
    ),
    async (c) => {
      const { users } = await createAdminClient();
      const databases = c.get("databases");
      const user = c.get("user");

      const {
        workspaceId,
        projectId,
        status,
        search,
        assigneeId,
        dueDate,
        weight,
      } = c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const query = [
        Query.equal("workspaceId", workspaceId),
        Query.orderDesc("$createdAt")
      ];

      if (projectId) {
        console.log("projectId: ", projectId);
        query.push(Query.equal("projectId", projectId));
      }

      if (status) {
        console.log("status: ", status);
        query.push(Query.equal("status", status));
      }

      if (assigneeId) {
        console.log("assigneeId: ", assigneeId);
        query.push(Query.equal("assigneeId", assigneeId));
      }

      if (dueDate) {
        console.log("dueDate: ", dueDate);
        query.push(Query.equal("dueDate", dueDate));
      }

      if (search) {
        console.log("search: ", search);
        query.push(Query.search("name", search));
      }

      const hasWeightFilter = !!weight && weight !== "all";
      let weightQueryAdded = false;

      if (hasWeightFilter) {
        if (weight === "unweighted") {
          query.push(Query.isNull("weight"));
          weightQueryAdded = true;
        } else {
          const numWeight = parseInt(weight, 10);
          if (!isNaN(numWeight)) {
            query.push(Query.equal("weight", numWeight));
            weightQueryAdded = true;
          }
        }
      }

      let tasks;
      try {
        tasks = await databases.listDocuments<Task>(
          DATABASE_ID,
          TASKS_ID,
          query,
        );
      } catch (error: unknown) {
        // Fallback for when the 'weight' attribute / index does not exist in Appwrite yet
        if (weightQueryAdded) {
          const fallbackQuery = query.slice(0, -1);
          tasks = await databases.listDocuments<Task>(
            DATABASE_ID,
            TASKS_ID,
            fallbackQuery,
          );

          if (weight === "unweighted") {
            tasks.documents = tasks.documents.filter((task) => !task.weight);
          } else if (weight) {
            const numWeight = parseInt(weight, 10);
            tasks.documents = tasks.documents.filter((task) => task.weight === numWeight);
          }
          tasks.total = tasks.documents.length;
        } else {
          throw error;
        }
      }


      const projectIds = tasks.documents.map((task) => task.projectId);
      const assigneeIds = tasks.documents.map((task) => task.assigneeId);

      const projects = await databases.listDocuments<Project>(
        DATABASE_ID,
        PROJECTS_ID,
        projectIds.length > 0 ? [Query.contains("$id", projectIds)] : [],
      );

      const members = await databases.listDocuments(
        DATABASE_ID,
        MEMBERS_ID,
        assigneeIds.length > 0 ? [Query.contains("$id", assigneeIds)] : [],
      );

      const assignees = await Promise.all(
        members.documents.map(async (member) => {
          const user = await users.get(member.userId);

          return {
            ...member,
            name: user.name || user.email,
            email: user.email,
          }
        })
      );

      const populatedTasks = tasks.documents.map((task) => {
        const project = projects.documents.find(
          (project) => project.$id === task.projectId,
        );
        const assignee = assignees.find(
          (assignee) => assignee.$id === task.assigneeId,
        );

        return {
          ...task,
          project,
          assignee,
        };
      });

      return c.json({
        data: {
          ...tasks,
          documents: populatedTasks,
        },
      });
    }
  )
  .post(
    "/",
    sessionMiddleware,
    zValidator("json", createTaskSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const {
        name,
        status,
        workspaceId,
        projectId,
        dueDate,
        assigneeId,
        description,
        weight,
      } = c.req.valid("json");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const highestPositionTask = await databases.listDocuments(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.equal("status", status),
          Query.equal("workspaceId", workspaceId),
          Query.orderAsc("position"),
          Query.limit(1),
        ],
      );

      const newPosition =
        highestPositionTask.documents.length > 0
          ? highestPositionTask.documents[0].position + 1000
          : 1000;

      const documentPayload: Record<string, unknown> = {
        name,
        status,
        workspaceId,
        projectId,
        dueDate,
        assigneeId,
        position: newPosition,
      };

      if (description) {
        documentPayload.description = description;
      }

      if (weight !== undefined && weight !== null) {
        documentPayload.weight = weight;
      }

      let task;
      try {
        task = await databases.createDocument(
          DATABASE_ID,
          TASKS_ID,
          ID.unique(),
          documentPayload,
        );
      } catch (error: unknown) {
        const errMessage = (error as { message?: string })?.message;
        console.error("Error creating document in Appwrite:", error);
        if (documentPayload.weight !== undefined && errMessage?.toLowerCase().includes("weight")) {
          console.warn("Appwrite Tasks collection is missing the 'weight' attribute! Document will be saved without weight until the attribute is created in Appwrite Console.");
          delete documentPayload.weight;
          task = await databases.createDocument(
            DATABASE_ID,
            TASKS_ID,
            ID.unique(),
            documentPayload,
          );
        } else {
          throw error;
        }
      }


      await createActivity({
        databases,
        workspaceId,
        projectId,
        userId: user.$id,
        userName: user.name,
        userEmail: user.email,
        eventCategory: EventCategory.TASKS,
        action: EventAction.CREATED,
        entityType: "task",
        entityId: task.$id,
        entityName: task.name,
        description: "Task created"
      });

      if (assigneeId) {
        const assigneeMember = await databases.getDocument(
          DATABASE_ID,
          MEMBERS_ID,
          assigneeId,
        );

        if (assigneeMember.userId !== user.$id) {
          await createNotification({
            databases,
            recipientId: assigneeMember.userId,
            workspaceId,
            projectId,
            taskId: task.$id,
            actorId: user.$id,
            actorName: user.name,
            type: NotificationType.TASK_ASSIGNED,
            title: "Task assigned to you",
            message: `${user.name} assigned "${task.name}" to you.`,
            entityType: "task",
            entityId: task.$id,
            entityName: task.name,
          });
        }
      }

      return c.json({ data: task });
    }
  )
  .patch(
    "/:taskId",
    sessionMiddleware,
    zValidator("json", createTaskSchema.partial()),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const {
        name,
        status,
        description,
        projectId,
        dueDate,
        assigneeId,
        weight,
      } = c.req.valid("json");
      const { taskId } = c.req.param();

      const existingTask = await databases.getDocument<Task>(
        DATABASE_ID,
        TASKS_ID,
        taskId,
      );

      const member = await getMember({
        databases,
        workspaceId: existingTask.workspaceId,
        userId: user.$id
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const updatePayload: Record<string, unknown> = {
        name,
        status,
        projectId,
        dueDate,
        assigneeId,
        description,
      };

      if (weight !== undefined) {
        updatePayload.weight = weight;
      }

      let task;
      try {
        task = await databases.updateDocument<Task>(
          DATABASE_ID,
          TASKS_ID,
          taskId,
          updatePayload,
        );
      } catch (error: unknown) {
        const errMessage = (error as { message?: string })?.message;
        console.error("Error updating document in Appwrite:", error);
        if (updatePayload.weight !== undefined && errMessage?.toLowerCase().includes("weight")) {
          console.warn("Appwrite Tasks collection is missing the 'weight' attribute! Document will be saved without weight until the attribute is created in Appwrite Console.");
          delete updatePayload.weight;
          task = await databases.updateDocument<Task>(
            DATABASE_ID,
            TASKS_ID,
            taskId,
            updatePayload,
          );
        } else {
          throw error;
        }
      }

      const changeDescriptions = [];
      if (existingTask.status !== task.status) changeDescriptions.push(`Status changed from ${existingTask.status} to ${task.status}`);
      if (existingTask.assigneeId !== task.assigneeId) changeDescriptions.push(`Assignee changed`);
      if (existingTask.name !== task.name) changeDescriptions.push(`Name changed`);

      const activityDescription = changeDescriptions.length > 0 ? changeDescriptions.join(", ") : "Task updated";

      await createActivity({
        databases,
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        userId: user.$id,
        userName: user.name,
        userEmail: user.email,
        eventCategory: EventCategory.TASKS,
        action: EventAction.UPDATED,
        entityType: "task",
        entityId: task.$id,
        entityName: task.name,
        description: activityDescription,
        metadata: JSON.stringify({ previousStatus: existingTask.status, newStatus: task.status })
      });
      console.log("🔔 Notification check:", {
        oldAssignee: existingTask.assigneeId,
        newAssignee: task.assigneeId,
        currentUser: user.$id,
      });

      if (
        existingTask.assigneeId !== task.assigneeId &&
        task.assigneeId
      ) {
        const assigneeMember = await databases.getDocument(
          DATABASE_ID,
          MEMBERS_ID,
          task.assigneeId,
        );

        console.log("🔔 Creating assignment notification:", {
          memberId: task.assigneeId,
          recipientUserId: assigneeMember.userId,
          currentUser: user.$id,
        });

        if (assigneeMember.userId !== user.$id) {
          await createNotification({
            databases,
            recipientId: assigneeMember.userId,
            workspaceId: task.workspaceId,
            projectId: task.projectId,
            taskId: task.$id,
            actorId: user.$id,
            actorName: user.name,
            type: NotificationType.TASK_ASSIGNED,
            title: "Task assigned to you",
            message: `${user.name} assigned "${task.name}" to you.`,
            entityType: "task",
            entityId: task.$id,
            entityName: task.name,
          });
        }
      } else if (
        existingTask.status !== task.status &&
        task.assigneeId
      ) {
        const assigneeMember = await databases.getDocument(
          DATABASE_ID,
          MEMBERS_ID,
          task.assigneeId,
        );

        console.log("🔔 Creating status notification:", {
          memberId: task.assigneeId,
          recipientUserId: assigneeMember.userId,
          currentUser: user.$id,
        });

        if (assigneeMember.userId !== user.$id) {
          await createNotification({
            databases,
            recipientId: assigneeMember.userId,
            workspaceId: task.workspaceId,
            projectId: task.projectId,
            taskId: task.$id,
            actorId: user.$id,
            actorName: user.name,
            type: NotificationType.TASK_STATUS_CHANGED,
            title: "Task status changed",
            message: `${user.name} changed status of "${task.name}" to ${task.status}.`,
            entityType: "task",
            entityId: task.$id,
            entityName: task.name,
          });
        }
      }

      return c.json({ data: task });
    }
  )
  .get(
    "/:taskId",
    sessionMiddleware,
    async (c) => {
      const currentUser = c.get("user");
      const databases = c.get("databases");
      const { users } = await createAdminClient();
      const { taskId } = c.req.param();

      const task = await databases.getDocument<Task>(
        DATABASE_ID,
        TASKS_ID,
        taskId,
      );

      const currentMember = await getMember({
        databases,
        workspaceId: task.workspaceId,
        userId: currentUser.$id,
      });

      if (!currentMember) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const project = await databases.getDocument<Project>(
        DATABASE_ID,
        PROJECTS_ID,
        task.projectId
      );

      const member = await databases.getDocument(
        DATABASE_ID,
        MEMBERS_ID,
        task.assigneeId
      );

      const user = await users.get(member.userId);

      const assignee = {
        ...member,
        name: user.name || user.email,
        email: user.email,
      };

      return c.json({
        data: {
          ...task,
          project,
          assignee,
        },
      });
    }
  )
  .post(
    "/bulk-update",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        tasks: z.array(
          z.object({
            $id: z.string(),
            status: z.nativeEnum(TaskStatus),
            position: z.number().int().positive().min(1000).max(1_000_000),
          })
        )
      })
    ),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { tasks } = await c.req.valid("json");

      const tasksToUpdate = await databases.listDocuments<Task>(
        DATABASE_ID,
        TASKS_ID,
        [Query.contains("$id", tasks.map((task) => task.$id))]
      );

      const workspaceIds = new Set(tasksToUpdate.documents.map(task => task.workspaceId));
      if (workspaceIds.size !== 1) {
        return c.json({ error: "All tasks must belong to the same workspace" })
      }

      const workspaceId = workspaceIds.values().next().value;

      if (!workspaceId) {
        return c.json({ error: "Workspace ID is required" }, 400);
      }

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const updatedTasks = await Promise.all(
        tasks.map(async (task) => {
          const { $id, status, position } = task;
          return databases.updateDocument<Task>(
            DATABASE_ID,
            TASKS_ID,
            $id,
            { status, position }
          );
        })
      );

      await createActivity({
        databases,
        workspaceId,
        userId: user.$id,
        userName: user.name,
        userEmail: user.email,
        eventCategory: EventCategory.TASKS,
        action: EventAction.UPDATED,
        entityType: "task",
        description: `Bulk updated ${tasks.length} task(s) position/status`
      });

      return c.json({ data: updatedTasks });
    }
  )


export default app;
