-- Custom SQL migration file, generated manually
-- adds 'cancelled' value to report_status and report_stage enums

--> statement-breakpoint
ALTER TYPE "public"."report_status" ADD VALUE IF NOT EXISTS 'cancelled';
--> statement-breakpoint
ALTER TYPE "public"."report_stage" ADD VALUE IF NOT EXISTS 'cancelled';
