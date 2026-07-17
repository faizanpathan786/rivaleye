CREATE TABLE IF NOT EXISTS "llm_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid,
	"tag" text,
	"model" text NOT NULL,
	"provider" text DEFAULT 'openrouter' NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"est_cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"latency_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"last_request" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "worker_heartbeats" (
	"worker_id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"in_flight" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "llm_usage" ADD CONSTRAINT "llm_usage_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "llm_usage_report_id_idx" ON "llm_usage" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "llm_usage_created_at_idx" ON "llm_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rate_limit_key_idx" ON "rate_limit" USING btree ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "worker_heartbeats_last_seen_at_idx" ON "worker_heartbeats" USING btree ("last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_transactions_razorpay_order_id_key" ON "credit_transactions" USING btree ("razorpay_order_id") WHERE "credit_transactions"."razorpay_order_id" is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_transactions_user_id_idx" ON "credit_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_actions_report_id_idx" ON "report_actions" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_complaints_report_id_idx" ON "report_complaints" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_feature_gaps_report_id_idx" ON "report_feature_gaps" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_leads_report_id_idx" ON "report_leads" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_opportunities_report_id_idx" ON "report_opportunities" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_platform_stats_report_id_idx" ON "report_platform_stats" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_positioning_report_id_idx" ON "report_positioning" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_pricing_quotes_report_id_idx" ON "report_pricing_quotes" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_pricing_tiers_report_id_idx" ON "report_pricing_tiers" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_quotes_report_id_idx" ON "report_quotes" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_subreddits_report_id_idx" ON "report_subreddits" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_switching_report_id_idx" ON "report_switching" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_thread_messages_thread_id_idx" ON "report_thread_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_threads_report_id_idx" ON "report_threads" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_voice_words_report_id_idx" ON "report_voice_words" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_owner_id_idx" ON "reports" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_pdf_jobs_report_id_idx" ON "report_pdf_jobs" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outreach_items_report_id_idx" ON "outreach_items" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "planned_actions_report_id_idx" ON "planned_actions" USING btree ("report_id");