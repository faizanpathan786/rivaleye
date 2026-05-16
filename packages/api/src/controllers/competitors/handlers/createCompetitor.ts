import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { createCompetitor } from "@/services/competitors.service";
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

export const createCompetitorBodySchema = t.Object({
  name: t.String({ minLength: 1 }),
  slug: t.Optional(t.String()),
  website: t.Optional(t.String()),
  category: t.Optional(t.String()),
  color: t.Optional(t.String()),
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
  notes: t.Optional(t.String()),
});

export const createCompetitorHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .post(
    "/",
    async ({ log, user, body, status }) => {
      try {
        const row = await createCompetitor(user!.id, body);
        return ok(row);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to create competitor",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      body: createCompetitorBodySchema,
      detail: { tags: [Tags.COMPETITORS], summary: "Create a tracked competitor" },
    },
  );
