import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { report_platform_jobs } from "@/db/schema/pipeline";
import type { NewReportPlatformJob } from "@/db/schema/pipeline";

export async function createPlatformJobs(rows: NewReportPlatformJob[]): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(report_platform_jobs).values(rows);
}

export async function markPlatformJobRunning(report_id: string, platform: string): Promise<void> {
  await db
    .update(report_platform_jobs)
    .set({ status: "running", started_at: new Date() })
    .where(and(eq(report_platform_jobs.report_id, report_id), eq(report_platform_jobs.platform, platform)));
}

export async function markPlatformJobCompleted(report_id: string, platform: string): Promise<void> {
  await db
    .update(report_platform_jobs)
    .set({ status: "completed", completed_at: new Date() })
    .where(and(eq(report_platform_jobs.report_id, report_id), eq(report_platform_jobs.platform, platform)));
}

export async function markPlatformJobFailed(
  report_id: string,
  platform: string,
  error: string,
): Promise<void> {
  await db
    .update(report_platform_jobs)
    .set({ status: "failed", error, completed_at: new Date() })
    .where(and(eq(report_platform_jobs.report_id, report_id), eq(report_platform_jobs.platform, platform)));
}

export async function countUnfinishedPlatformJobs(report_id: string): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(report_platform_jobs)
    .where(
      and(
        eq(report_platform_jobs.report_id, report_id),
        inArray(report_platform_jobs.status, ["queued", "running"]),
      ),
    );
  return result[0]?.value ?? 0;
}
