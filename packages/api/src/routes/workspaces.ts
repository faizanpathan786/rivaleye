import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db, workspaces, workspaceMembers } from "@rivaleye/db";
import { requireAuth } from "../plugins/auth.js";

export async function workspaceRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [requireAuth] }, async (request, reply) => {
    const members = await db
      .select({ workspace: workspaces })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(eq(workspaceMembers.userId, request.user.userId));

    return reply.send({ success: true, data: members.map((m) => m.workspace) });
  });
}
