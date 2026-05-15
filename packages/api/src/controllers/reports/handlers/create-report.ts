import { Elysia, t } from "elysia";

export const createReport = new Elysia().post(
  "/",
  async ({ body }) => {
    return { id: crypto.randomUUID(), status: "queued", input: body };
  },
  {
    body: t.Object({
      category: t.String(),
      competitors: t.Array(t.String()),
      audience: t.Optional(t.String()),
      goal: t.Union([
        t.Literal("validate_idea"),
        t.Literal("find_weaknesses"),
        t.Literal("improve_positioning"),
        t.Literal("decide_mvp_features"),
        t.Literal("find_user_pain"),
        t.Literal("compare_alternatives"),
      ]),
    }),
  },
);
