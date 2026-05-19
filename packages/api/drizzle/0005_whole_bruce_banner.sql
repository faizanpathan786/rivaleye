-- Postgres runner additions: synthesis_jobs, new report_platform_jobs columns, updated indexes
-- NOTE: report_platform_stage, pipeline_event_kind, pipeline_events, and base columns
-- already exist from 0003_pipeline_events_and_extensions.sql (manual migration).

--> statement-breakpoint
ALTER TYPE "public"."report_platform_stage" ADD VALUE IF NOT EXISTS 'queued';
--> statement-breakpoint
ALTER TYPE "public"."report_platform_stage" ADD VALUE IF NOT EXISTS 'fetching';
--> statement-breakpoint
ALTER TYPE "public"."report_platform_stage" ADD VALUE IF NOT EXISTS 'storing_mentions';
--> statement-breakpoint
ALTER TYPE "public"."report_platform_stage" ADD VALUE IF NOT EXISTS 'extracting';
--> statement-breakpoint
ALTER TYPE "public"."report_platform_stage" ADD VALUE IF NOT EXISTS 'summarizing';
--> statement-breakpoint
ALTER TYPE "public"."report_platform_stage" ADD VALUE IF NOT EXISTS 'completed';
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."synthesis_job_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "synthesis_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"status" "synthesis_job_status" DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 2 NOT NULL,
	"run_after" timestamp DEFAULT now() NOT NULL,
	"locked_at" timestamp,
	"locked_by" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "synthesis_jobs_report_id_uniq" UNIQUE("report_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "synthesis_jobs" ADD CONSTRAINT "synthesis_jobs_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "report_platform_jobs" ADD COLUMN IF NOT EXISTS "run_after" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "report_platform_jobs" ADD COLUMN IF NOT EXISTS "locked_at" timestamp;
--> statement-breakpoint
ALTER TABLE "report_platform_jobs" ADD COLUMN IF NOT EXISTS "locked_by" text;
--> statement-breakpoint
ALTER TABLE "report_platform_jobs" ADD COLUMN IF NOT EXISTS "max_attempts" integer DEFAULT 3 NOT NULL;
--> statement-breakpoint
ALTER TABLE "report_platform_jobs" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "synthesis_jobs_status_run_after_idx" ON "synthesis_jobs" USING btree ("status","run_after","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "synthesis_jobs_report_id_idx" ON "synthesis_jobs" USING btree ("report_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "synthesis_jobs_locked_at_idx" ON "synthesis_jobs" USING btree ("locked_at") WHERE status = 'running';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_platform_jobs_status_run_after_idx" ON "report_platform_jobs" USING btree ("status","run_after","created_at") WHERE status = 'queued';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_platform_jobs_report_id_status_idx" ON "report_platform_jobs" USING btree ("report_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_platform_jobs_locked_at_idx" ON "report_platform_jobs" USING btree ("locked_at") WHERE status = 'running';
