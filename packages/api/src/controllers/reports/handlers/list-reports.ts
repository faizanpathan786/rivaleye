import { Elysia } from "elysia";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import { desc } from "drizzle-orm";

export const listReports = new Elysia().get("/", async () => {
  const rows = await db
    .select()
    .from(reports)
    .orderBy(desc(reports.createdAt));

  return { reports: rows };
});
