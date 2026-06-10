import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { updateCompetitor } from "@/services/competitors.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

const socialsSchema = t.Object({
  linkedin: t.Optional(t.String()),
  twitter: t.Optional(t.String()),
  github: t.Optional(t.String()),
  youtube: t.Optional(t.String()),
  producthunt: t.Optional(t.String()),
  blog: t.Optional(t.String()),
});

const nullableString = t.Optional(t.Union([t.String(), t.Null()]));

export const updateCompetitorBodySchema = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  slug: t.Optional(t.String()),
  website: nullableString,
  category: nullableString,
  color: nullableString,
  priority: t.Optional(
    t.Union([t.Literal("primary"), t.Literal("secondary"), t.Literal("tertiary")]),
  ),
  tags: t.Optional(t.Array(t.String())),
  socials: t.Optional(socialsSchema),
  monitor_enabled: t.Optional(t.Boolean()),
  monitor_sensitivity: t.Optional(
    t.Union([t.Literal("low"), t.Literal("med"), t.Literal("high")]),
  ),
  monitor_watch: t.Optional(t.Array(t.String())),
  notes: nullableString,
});

export const updateCompetitorHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .patch(
    "/:id",
    async ({ log, user, params, body, status }) => {
      try {
        const row = await updateCompetitor(params.id, user!.id, body);
        if (!row)
          return status(404, { message: "Competitor not found", error: "COMPETITOR_NOT_FOUND" });
        return ok(row);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to update competitor",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      body: updateCompetitorBodySchema,
      detail: { tags: [Tags.COMPETITORS], summary: "Update a competitor" },
    },
  );
