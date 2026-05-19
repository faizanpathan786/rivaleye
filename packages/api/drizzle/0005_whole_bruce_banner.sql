CREATE TYPE "public"."report_platform_stage" AS ENUM('queued', 'scrape', 'stage_a', 'stage_b', 'done', 'failed', 'fetching', 'storing_mentions', 'extracting', 'summarizing', 'completed');--> statement-breakpoint
CREATE TYPE "public"."synthesis_job_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."pipeline_event_kind" AS ENUM('started', 'completed', 'failed', 'retrying');--> statement-breakpoint
ALTER TYPE "public"."report_stage" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."report_status" ADD VALUE 'cancelled';--> statement-breakpoint
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
CREATE TABLE IF NOT EXISTS "pipeline_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"report_id" uuid NOT NULL,
	"platform" text,
	"stage" text NOT NULL,
	"event" "pipeline_event_kind" NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"duration_ms" integer,
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "partial" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "failed_platforms" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "report_platform_jobs" ADD COLUMN "stage" "report_platform_stage" DEFAULT 'scrape' NOT NULL;--> statement-breakpoint
ALTER TABLE "report_platform_jobs" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "report_platform_jobs" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "report_platform_jobs" ADD COLUMN "last_event_at" timestamp;--> statement-breakpoint
ALTER TABLE "report_platform_jobs" ADD COLUMN "run_after" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "report_platform_jobs" ADD COLUMN "locked_at" timestamp;--> statement-breakpoint
ALTER TABLE "report_platform_jobs" ADD COLUMN "locked_by" text;--> statement-breakpoint
ALTER TABLE "report_platform_jobs" ADD COLUMN "max_attempts" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "report_platform_jobs" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "synthesis_jobs" ADD CONSTRAINT "synthesis_jobs_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pipeline_events" ADD CONSTRAINT "pipeline_events_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "synthesis_jobs_status_run_after_idx" ON "synthesis_jobs" USING btree ("status","run_after","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "synthesis_jobs_report_id_idx" ON "synthesis_jobs" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "synthesis_jobs_locked_at_idx" ON "synthesis_jobs" USING btree ("locked_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pipeline_events_report_id_idx" ON "pipeline_events" USING btree ("report_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_platform_jobs_status_run_after_idx" ON "report_platform_jobs" USING btree ("status","run_after","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_platform_jobs_report_id_status_idx" ON "report_platform_jobs" USING btree ("report_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_platform_jobs_locked_at_idx" ON "report_platform_jobs" USING btree ("locked_at");