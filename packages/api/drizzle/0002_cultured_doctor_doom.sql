CREATE TYPE "public"."report_stage" AS ENUM('queued', 'scraping', 'clustering', 'done', 'failed');--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "stage" "report_stage" DEFAULT 'queued' NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "error" text;