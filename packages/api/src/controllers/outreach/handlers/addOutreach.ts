import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { addOutreach } from "@/services/outreach.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

const nullableString = t.Optional(t.Union([t.String(), t.Null()]));

export const addOutreachBodySchema = t.Object({
  report_id: t.String({ format: "uuid" }),
  title: t.String({ minLength: 1 }),
  pricing_issue: nullableString,
  plan_limitation: nullableString,
  team_size_hint: nullableString,
  budget_sensitivity: nullableString,
  alternative_interest: nullableString,
  suggested_pricing_angle: nullableString,
  source_url: nullableString,
});

export const addOutreachHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .post(
    "/",
    async ({ log, user, body, status }) => {
      try {
        const row = await addOutreach(user!.id, body);
        return ok(row);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to add outreach item",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      body: addOutreachBodySchema,
      detail: { tags: [Tags.OUTREACH], summary: "Save a lead to outreach" },
    },
  );
