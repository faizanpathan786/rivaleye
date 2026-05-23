CREATE TYPE "public"."report_section_type" AS ENUM('overview', 'founder', 'product', 'marketing', 'growth', 'evidence');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_role_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"section_type" "report_section_type" NOT NULL,
	"data" jsonb NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "report_role_sections_report_section_uniq" UNIQUE("report_id","section_type")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_role_sections" ADD CONSTRAINT "report_role_sections_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
