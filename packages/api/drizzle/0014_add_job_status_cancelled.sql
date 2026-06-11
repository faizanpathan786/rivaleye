-- adds 'cancelled' value to report_platform_job_status enum
ALTER TYPE "public"."report_platform_job_status" ADD VALUE IF NOT EXISTS 'cancelled';
