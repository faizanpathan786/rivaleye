DROP INDEX IF EXISTS "report_platform_jobs_status_run_after_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "report_platform_jobs_locked_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "synthesis_jobs_locked_at_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_platform_jobs_status_run_after_idx" ON "report_platform_jobs" USING btree ("status","run_after","created_at") WHERE status = 'queued';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_platform_jobs_locked_at_idx" ON "report_platform_jobs" USING btree ("locked_at") WHERE status = 'running';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "synthesis_jobs_locked_at_idx" ON "synthesis_jobs" USING btree ("locked_at") WHERE status = 'running';