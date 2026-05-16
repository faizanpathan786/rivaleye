CREATE TYPE "public"."report_platform_job_status" AS ENUM('queued', 'running', 'completed', 'failed');
--> statement-breakpoint
CREATE TABLE "report_platform_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"status" "report_platform_job_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "report_platform_jobs_report_platform_uniq" UNIQUE("report_id","platform")
);
--> statement-breakpoint
CREATE TABLE "report_platform_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"extract" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"model_used" text NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "report_platform_briefs_report_platform_uniq" UNIQUE("report_id","platform")
);
--> statement-breakpoint
ALTER TABLE "report_platform_jobs" ADD CONSTRAINT "report_platform_jobs_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "report_platform_briefs" ADD CONSTRAINT "report_platform_briefs_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "report_platform_jobs_report_id_idx" ON "report_platform_jobs" USING btree ("report_id");
--> statement-breakpoint
CREATE INDEX "report_platform_briefs_report_id_idx" ON "report_platform_briefs" USING btree ("report_id");
