CREATE TYPE "public"."complaint_severity" AS ENUM('low', 'med', 'high');--> statement-breakpoint
CREATE TYPE "public"."effort_level" AS ENUM('low', 'med', 'high');--> statement-breakpoint
CREATE TYPE "public"."payoff_level" AS ENUM('low', 'med', 'high');--> statement-breakpoint
CREATE TYPE "public"."report_goal" AS ENUM('validate_idea', 'find_weaknesses', 'improve_positioning', 'decide_mvp_features', 'find_user_pain', 'compare_alternatives');--> statement-breakpoint
CREATE TYPE "public"."report_stage" AS ENUM('queued', 'scraping', 'clustering', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."switching_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."voice_word_kind" AS ENUM('positive', 'negative');--> statement-breakpoint
CREATE TYPE "public"."competitor_priority" AS ENUM('primary', 'secondary', 'tertiary');--> statement-breakpoint
CREATE TYPE "public"."monitor_sensitivity" AS ENUM('low', 'med', 'high');--> statement-breakpoint
CREATE TYPE "public"."radar_event_type" AS ENUM('feature-leak', 'demo-video', 'launch', 'pricing-change', 'exec-post', 'viral-complaint', 'review-spike', 'feature-launch', 'hire');--> statement-breakpoint
CREATE TYPE "public"."radar_severity" AS ENUM('low', 'med', 'high', 'urgent');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"step" text NOT NULL,
	"detail" text,
	"effort" "effort_level" DEFAULT 'med' NOT NULL,
	"role" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_complaints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"tag" text,
	"mentions" integer DEFAULT 0 NOT NULL,
	"delta" text,
	"severity" real DEFAULT 0 NOT NULL,
	"summary" text,
	"threads" integer DEFAULT 0 NOT NULL,
	"sample" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_feature_gaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"feature" text NOT NULL,
	"votes" integer DEFAULT 0 NOT NULL,
	"signal" real DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"who" text NOT NULL,
	"sub" text,
	"when_label" text,
	"score" integer DEFAULT 0 NOT NULL,
	"signal" text,
	"quote" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"title" text NOT NULL,
	"thesis" text,
	"effort" "effort_level" DEFAULT 'med' NOT NULL,
	"payoff" "payoff_level" DEFAULT 'med' NOT NULL,
	"anchor_complaint_external_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_platform_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"platform_id" text NOT NULL,
	"name" text NOT NULL,
	"posts" integer DEFAULT 0 NOT NULL,
	"sentiment" real,
	"contexts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_positioning" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"angle" text NOT NULL,
	"thesis" text,
	"audience" text,
	"against" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_pricing_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"who" text NOT NULL,
	"sub" text,
	"text" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_pricing_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"tier" text NOT NULL,
	"pain" real DEFAULT 0 NOT NULL,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"who" text NOT NULL,
	"sub" text,
	"when_label" text,
	"score" integer DEFAULT 0 NOT NULL,
	"sentiment" real,
	"text" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_subreddits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"name" text NOT NULL,
	"posts" integer DEFAULT 0 NOT NULL,
	"sentiment" real,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_switching" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"direction" "switching_direction" NOT NULL,
	"competitor_name" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"share" real DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_thread_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"author" text,
	"body" text NOT NULL,
	"posted_at" timestamp,
	"score" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"complaint_external_id" text,
	"platform" text NOT NULL,
	"url" text,
	"title" text NOT NULL,
	"author" text,
	"sub" text,
	"posted_at" timestamp,
	"score" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_voice_words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"kind" "voice_word_kind" NOT NULL,
	"word" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"category" text NOT NULL,
	"competitors" jsonb NOT NULL,
	"audience" text,
	"goal" "report_goal" NOT NULL,
	"status" "report_status" DEFAULT 'queued' NOT NULL,
	"stage" "report_stage" DEFAULT 'queued' NOT NULL,
	"error" text,
	"primary_competitor_name" text,
	"primary_competitor_domain" text,
	"scanned_at" timestamp,
	"time_range" text,
	"total_sources" integer,
	"total_threads" integer,
	"sentiment_overall" real,
	"sentiment_positive" real,
	"sentiment_neutral" real,
	"sentiment_negative" real,
	"sentiment_trend" text,
	"sentiment_series" jsonb DEFAULT '[]'::jsonb,
	"voice_summary" text,
	"voice_phrases" jsonb DEFAULT '[]'::jsonb,
	"pricing_blended" text,
	"pricing_pain_score" real,
	"switching_net_signal" text,
	"switching_reasons_out" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"category" text,
	"color" text,
	"priority" "competitor_priority" DEFAULT 'secondary' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"socials" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"monitor_enabled" boolean DEFAULT true NOT NULL,
	"monitor_sensitivity" "monitor_sensitivity" DEFAULT 'med' NOT NULL,
	"monitor_watch" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"stat_sentiment" real,
	"stat_mentions" integer DEFAULT 0 NOT NULL,
	"stat_alerts_7d" integer DEFAULT 0 NOT NULL,
	"last_activity_at" timestamp,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"author" text,
	"title" text,
	"body" text NOT NULL,
	"score" integer,
	"num_comments" integer,
	"posted_at" timestamp NOT NULL,
	"raw" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mentions_report_platform_external_uniq" UNIQUE("report_id","platform","external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "radar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competitor_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"type" "radar_event_type" NOT NULL,
	"severity" "radar_severity" NOT NULL,
	"title" text NOT NULL,
	"snippet" text,
	"url" text,
	"who" text,
	"role" text,
	"confidence" real DEFAULT 0 NOT NULL,
	"impact" text,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_actions" ADD CONSTRAINT "report_actions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_complaints" ADD CONSTRAINT "report_complaints_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_feature_gaps" ADD CONSTRAINT "report_feature_gaps_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_leads" ADD CONSTRAINT "report_leads_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_opportunities" ADD CONSTRAINT "report_opportunities_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_platform_stats" ADD CONSTRAINT "report_platform_stats_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_positioning" ADD CONSTRAINT "report_positioning_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_pricing_quotes" ADD CONSTRAINT "report_pricing_quotes_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_pricing_tiers" ADD CONSTRAINT "report_pricing_tiers_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_quotes" ADD CONSTRAINT "report_quotes_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_subreddits" ADD CONSTRAINT "report_subreddits_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_switching" ADD CONSTRAINT "report_switching_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_thread_messages" ADD CONSTRAINT "report_thread_messages_thread_id_report_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."report_threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_threads" ADD CONSTRAINT "report_threads_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_voice_words" ADD CONSTRAINT "report_voice_words_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "competitors" ADD CONSTRAINT "competitors_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mentions" ADD CONSTRAINT "mentions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "radar_events" ADD CONSTRAINT "radar_events_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mentions_report_id_idx" ON "mentions" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "radar_events_competitor_id_idx" ON "radar_events" USING btree ("competitor_id");