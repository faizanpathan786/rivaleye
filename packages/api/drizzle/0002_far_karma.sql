CREATE TYPE "public"."pipeline_checkpoint_stage" AS ENUM('C', 'D', 'E');--> statement-breakpoint
CREATE TYPE "public"."log_level" AS ENUM('info', 'warn', 'error');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_pipeline_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"stage" "pipeline_checkpoint_stage" NOT NULL,
	"output" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "report_pipeline_checkpoints_report_stage_uniq" UNIQUE("report_id","stage")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"level" "log_level" NOT NULL,
	"stage" text,
	"platform" text,
	"message" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_pipeline_checkpoints" ADD CONSTRAINT "report_pipeline_checkpoints_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_logs" ADD CONSTRAINT "report_logs_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_pipeline_checkpoints_report_id_idx" ON "report_pipeline_checkpoints" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_logs_report_id_created_at_idx" ON "report_logs" USING btree ("report_id","created_at");--> statement-breakpoint
DROP TYPE "public"."complaint_severity";