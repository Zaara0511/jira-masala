import { z } from "zod";
import { Hono } from "hono";
import { Query } from "node-appwrite";
import { zValidator } from "@hono/zod-validator";

import { createAdminClient } from "@/lib/appwrite";
import { DATABASE_ID, MEMBERS_ID } from "@/config";
import { sessionMiddleware } from "@/lib/session-middleware";

import { createActivity } from "@/features/activities/server/service";
import { EventCategory, EventAction } from "@/features/activities/types";

import { getMember } from "../utils";
import { Member, MemberRole } from "../types";

const app = new Hono()
  .get(
    "/",
    sessionMiddleware,
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const { users } = await createAdminClient();
      const databases = c.get("databases");
      const user = c.get("user");
      const { workspaceId } = c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const members = await databases.listDocuments<Member>(
        DATABASE_ID,
        MEMBERS_ID,
        [Query.equal("workspaceId", workspaceId)]
      );

      const populatedMembers = await Promise.all(
        members.documents.map(async (member) => {
          const user = await users.get(member.userId);

          return {
            ...member,
            name: user.name || user.email,
            email: user.email,
          }
        })
      );

      return c.json({
        data: {
          ...members,
          documents: populatedMembers,
        },
      });
    }
  )
  .delete(
    "/:memberId",
    sessionMiddleware,
    async (c) => {
      const { memberId } = c.req.param();
      const user = c.get("user");
      const databases = c.get("databases");

      const memberToDelete = await databases.getDocument(
        DATABASE_ID,
        MEMBERS_ID,
        memberId,
      );

      const allMembersInWorkspace = await databases.listDocuments(
        DATABASE_ID,
        MEMBERS_ID,
        [Query.equal("workspaceId", memberToDelete.workspaceId)]
      );

      const member = await getMember({
        databases,
        workspaceId: memberToDelete.workspaceId,
        userId: user.$id
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (member.$id !== memberToDelete.$id && member.role !== MemberRole.ADMIN) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (allMembersInWorkspace.total === 1) {
        return c.json({ error: "Cannot delete the only member" }, 400);
      }

      await databases.deleteDocument(
        DATABASE_ID,
        MEMBERS_ID,
        memberId,
      );

      await createActivity({
        databases,
        workspaceId: memberToDelete.workspaceId,
        userId: user.$id,
        userName: user.name,
        userEmail: user.email,
        eventCategory: EventCategory.MEMBERS,
        action: EventAction.REMOVED,
        entityType: "member",
        entityId: memberToDelete.$id,
        description: "Member removed from workspace"
      });

      return c.json({ data: { $id: memberToDelete.$id } });
    }
  )
  .patch(
    "/:memberId",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        role: z.nativeEnum(MemberRole).optional(),
        designation: z.string().trim().max(100).optional().nullable(),
      })
    ),
    async (c) => {
      const { memberId } = c.req.param();
      const { role, designation } = c.req.valid("json");
      const user = c.get("user");
      const databases = c.get("databases");

      const memberToUpdate = await databases.getDocument(
        DATABASE_ID,
        MEMBERS_ID,
        memberId,
      );

      const allMembersInWorkspace = await databases.listDocuments(
        DATABASE_ID,
        MEMBERS_ID,
        [Query.equal("workspaceId", memberToUpdate.workspaceId)]
      );

      const member = await getMember({
        databases,
        workspaceId: memberToUpdate.workspaceId,
        userId: user.$id
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (member.role !== MemberRole.ADMIN) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (role && role !== memberToUpdate.role && allMembersInWorkspace.total === 1) {
        return c.json({ error: "Cannot downgrade the only member" }, 400);
      }

      const updateData: { role?: MemberRole; designation?: string } = {};
      if (role !== undefined) {
        updateData.role = role;
      }
      if (designation !== undefined) {
        updateData.designation = designation || "";
      }

      await databases.updateDocument(
        DATABASE_ID,
        MEMBERS_ID,
        memberId,
        updateData,
      );

      const changeDescriptions = [];
      if (role !== undefined && role !== memberToUpdate.role) {
        changeDescriptions.push(`Role changed from ${memberToUpdate.role} to ${role}`);
      }
      if (designation !== undefined && designation !== memberToUpdate.designation) {
        changeDescriptions.push(`Designation updated`);
      }

      if (changeDescriptions.length > 0) {
        await createActivity({
          databases,
          workspaceId: memberToUpdate.workspaceId,
          userId: user.$id,
          userName: user.name,
          userEmail: user.email,
          eventCategory: EventCategory.MEMBERS,
          action: role !== undefined && role !== memberToUpdate.role ? EventAction.ROLE_CHANGED : EventAction.UPDATED,
          entityType: "member",
          entityId: memberToUpdate.$id,
          description: changeDescriptions.join(", "),
          metadata: JSON.stringify(updateData)
        });
      }

      return c.json({ data: { $id: memberToUpdate.$id } });
    }
  )

export default app;
