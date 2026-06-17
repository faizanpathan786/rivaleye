CREATE TABLE IF NOT EXISTS "outreach_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"title" text NOT NULL,
	"pricing_issue" text,
	"plan_limitation" text,
	"team_size_hint" text,
	"budget_sensitivity" text,
	"alternative_interest" text,
	"suggested_pricing_angle" text,
	"source_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "outreach_items_owner_report_title_uniq" UNIQUE("owner_id","report_id","title")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outreach_items" ADD CONSTRAINT "outreach_items_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outreach_items" ADD CONSTRAINT "outreach_items_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outreach_items_owner_id_idx" ON "outreach_items" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_transactions_razorpay_payment_id_key" ON "credit_transactions" USING btree ("razorpay_payment_id") WHERE "credit_transactions"."razorpay_payment_id" is not null;
