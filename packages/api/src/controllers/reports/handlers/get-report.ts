import { Elysia, t } from "elysia";

export const getReport = new Elysia().get(
  "/:id",
  async ({ params }) => {
    return { id: params.id, status: "pending" };
  },
  { params: t.Object({ id: t.String() }) },
);
