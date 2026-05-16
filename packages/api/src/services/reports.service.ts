import { db } from "@/db/client";
import { reports } from "@/db/schema/reports";
import { enqueueScrapePlatform } from "@/libs/queue";
import { eq } from "drizzle-orm";
import type { CreateReportInput } from "@rivaleye/shared";

export async function createReport(input: CreateReportInput): Promise<{ id: string }> {
  const [row] = await db
    .insert(reports)
    .values({
      category: input.category,
      competitors: input.competitors,
      audience: input.target_audience,
      goal: input.founder_goal,
      status: "queued",
      stage: "queued",
      ownerId: null,
    })
    .returning({ id: reports.id });

  if (!row) throw new Error("Failed to insert report");

  await enqueueScrapePlatform({
    reportId: row.id,
    platform: "reddit",
    competitor: input.competitors[0] ?? input.category,
    category: input.category,
  });

  return { id: row.id };
}

export async function getReport(id: string) {
  const rows = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  return rows[0] ?? null;
}
