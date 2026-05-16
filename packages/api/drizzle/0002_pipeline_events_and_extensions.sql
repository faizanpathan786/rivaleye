-- Custom SQL migration file, generated manually
-- extends report_platform_jobs, reports; creates pipeline_events

--> statement-breakpoint
CREATE TYPE "public"."report_platform_stage" AS ENUM('scrape', 'stage_a', 'stage_b', 'done', 'failed');
--> statement-breakpoint
CREATE TYPE "public"."pipeline_event_kind" AS ENUM('started', 'completed', 'failed', 'retrying');
--> statement-breakpoint
ALTER TABLE "report_platform_jobs"
  ADD COLUMN "stage" "report_platform_stage" NOT NULL DEFAULT 'scrape',
  ADD COLUMN "attempt_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN "last_error" text,
  ADD COLUMN "last_event_at" timestamp;
--> statement-breakpoint
ALTER TABLE "reports"
  ADD COLUMN "partial" boolean NOT NULL DEFAULT false,
  ADD COLUMN "failed_platforms" text[] NOT NULL DEFAULT '{}';
--> statement-breakpoint
CREATE TABLE "pipeline_events" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "report_id" uuid NOT NULL,
  "platform" text,
  "stage" text NOT NULL,
  "event" "pipeline_event_kind" NOT NULL,
  "attempt" integer NOT NULL DEFAULT 1,
  "duration_ms" integer,
  "error" text,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "pipeline_events"
  ADD CONSTRAINT "pipeline_events_report_id_reports_id_fk"
  FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "pipeline_events_report_id_idx" ON "pipeline_events" USING btree ("report_id","created_at");
