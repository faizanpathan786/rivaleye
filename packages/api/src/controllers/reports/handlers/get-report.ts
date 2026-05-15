import { Elysia, t } from "elysia";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import { eq } from "drizzle-orm";

export const getReport = new Elysia().get(
  "/:id",
  async ({ params, status }) => {
    const [row] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, params.id))
      .limit(1);

    if (!row) return status(404, { message: "report not found" });
    return row;
  },
  { params: t.Object({ id: t.String() }) },
);
