CREATE TYPE "public"."report_pdf_job_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_pdf_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"lens" text,
	"status" "report_pdf_job_status" DEFAULT 'queued' NOT NULL,
	"session_cookie" text,
	"pdf_base64" text,
	"error" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 2 NOT NULL,
	"run_after" timestamp DEFAULT now() NOT NULL,
	"locked_at" timestamp,
	"locked_by" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_pdf_jobs" ADD CONSTRAINT "report_pdf_jobs_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_pdf_jobs" ADD CONSTRAINT "report_pdf_jobs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_pdf_jobs_status_run_after_idx" ON "report_pdf_jobs" USING btree ("status","run_after","created_at") WHERE status = 'queued';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_pdf_jobs_owner_id_idx" ON "report_pdf_jobs" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_pdf_jobs_locked_at_idx" ON "report_pdf_jobs" USING btree ("locked_at") WHERE status = 'running';