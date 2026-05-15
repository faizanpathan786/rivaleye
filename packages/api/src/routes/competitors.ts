import type { FastifyInstance } from "fastify";
import { createCompetitorSchema, updateCompetitorSchema } from "@rivaleye/shared";
import { requireAuth } from "../plugins/auth.js";
import {
  createCompetitor,
  getCompetitorsByWorkspace,
  getCompetitorById,
  updateCompetitor,
  deleteCompetitor,
} from "../services/competitor.service.js";
import { enqueueIngestion } from "../queues.js";

export async function competitorRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [requireAuth] }, async (request, reply) => {
    const list = await getCompetitorsByWorkspace(request.user.workspaceId);
    return reply.send({ success: true, data: list });
  });

  app.post("/", { preHandler: [requireAuth] }, async (request, reply) => {
    const body = createCompetitorSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ success: false, error: "Invalid input", code: "VALIDATION_ERROR" });
    }

    const competitor = await createCompetitor(
      request.user.workspaceId,
      body.data.name,
      body.data.website,
    );

    return reply.status(201).send({ success: true, data: competitor });
  });

  app.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const competitor = await getCompetitorById(request.params.id, request.user.workspaceId);
      if (!competitor) {
        return reply.status(404).send({ success: false, error: "Competitor not found", code: "NOT_FOUND" });
      }
      return reply.send({ success: true, data: competitor });
    },
  );

  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = updateCompetitorSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ success: false, error: "Invalid input", code: "VALIDATION_ERROR" });
      }

      const cleanUpdates = Object.fromEntries(
        Object.entries(body.data).filter(([, v]) => v !== undefined),
      ) as Partial<{ name: string; website: string | null; status: "active" | "paused" | "archived" }>;
      const updated = await updateCompetitor(request.params.id, request.user.workspaceId, cleanUpdates);
      if (!updated) {
        return reply.status(404).send({ success: false, error: "Competitor not found", code: "NOT_FOUND" });
      }

      return reply.send({ success: true, data: updated });
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const deleted = await deleteCompetitor(request.params.id, request.user.workspaceId);
      if (!deleted) {
        return reply.status(404).send({ success: false, error: "Competitor not found", code: "NOT_FOUND" });
      }
      return reply.send({ success: true, data: deleted });
    },
  );

  // Manual re-sync
  app.post<{ Params: { id: string } }>(
    "/:id/sync",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const competitor = await getCompetitorById(request.params.id, request.user.workspaceId);
      if (!competitor) {
        return reply.status(404).send({ success: false, error: "Competitor not found", code: "NOT_FOUND" });
      }

      await enqueueIngestion(competitor.id);
      return reply.send({ success: true, data: { message: "Sync queued" } });
    },
  );
}
