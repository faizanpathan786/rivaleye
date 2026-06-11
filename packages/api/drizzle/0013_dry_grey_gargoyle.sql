ALTER TYPE "public"."report_platform_job_status" ADD VALUE 'retry_pending';--> statement-breakpoint
ALTER TABLE "report_platform_jobs" ADD COLUMN "next_retry_at" timestamp;--> statement-breakpoint
ALTER TABLE "report_platform_jobs" ADD COLUMN "bg_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "report_platform_jobs" ADD COLUMN "bg_max_attempts" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "synthesis_jobs" ADD COLUMN "rerun_requested" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_platform_jobs_retry_pending_idx" ON "report_platform_jobs" USING btree ("status","next_retry_at");