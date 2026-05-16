import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const report_status_enum = pgEnum("report_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

export const report_goal_enum = pgEnum("report_goal", [
  "validate_idea",
  "find_weaknesses",
  "improve_positioning",
  "decide_mvp_features",
  "find_user_pain",
  "compare_alternatives",
]);

export const report_stage_enum = pgEnum("report_stage", [
  "queued",
  "scraping",
  "clustering",
  "done",
  "failed",
]);

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  owner_id: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  competitors: jsonb("competitors").$type<string[]>().notNull(),
  audience: text("audience"),
  goal: report_goal_enum("goal").notNull(),
  status: report_status_enum("status").notNull().default("queued"),
  stage: report_stage_enum("stage").notNull().default("queued"),
  error: text("error"),

  primary_competitor_name: text("primary_competitor_name"),
  primary_competitor_domain: text("primary_competitor_domain"),
  scanned_at: timestamp("scanned_at"),
  time_range: text("time_range"),
  total_sources: integer("total_sources"),
  total_threads: integer("total_threads"),
  sentiment_overall: real("sentiment_overall"),
  sentiment_positive: real("sentiment_positive"),
  sentiment_neutral: real("sentiment_neutral"),
  sentiment_negative: real("sentiment_negative"),
  sentiment_trend: text("sentiment_trend"),
  sentiment_series: jsonb("sentiment_series").$type<number[]>().default([]),
  voice_summary: text("voice_summary"),
  voice_phrases: jsonb("voice_phrases").$type<string[]>().default([]),
  pricing_blended: text("pricing_blended"),
  pricing_pain_score: real("pricing_pain_score"),
  switching_net_signal: text("switching_net_signal"),
  switching_reasons_out: jsonb("switching_reasons_out").$type<string[]>().default([]),

  partial: boolean("partial").notNull().default(false),
  failed_platforms: text("failed_platforms").array().notNull().default([]),

  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const report_platform_stats = pgTable("report_platform_stats", {
  id: uuid("id").primaryKey().defaultRandom(),
  report_id: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  platform_id: text("platform_id").notNull(),
  name: text("name").notNull(),
  posts: integer("posts").notNull().default(0),
  sentiment: real("sentiment"),
  contexts: jsonb("contexts").$type<string[]>().notNull().default([]),
  sort_order: integer("sort_order").notNull().default(0),
});

export const report_subreddits = pgTable("report_subreddits", {
  id: uuid("id").primaryKey().defaultRandom(),
  report_id: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  posts: integer("posts").notNull().default(0),
  sentiment: real("sentiment"),
  sort_order: integer("sort_order").notNull().default(0),
});

export const report_complaints = pgTable("report_complaints", {
  id: uuid("id").primaryKey().defaultRandom(),
  report_id: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  external_id: text("external_id").notNull(),
  title: text("title").notNull(),
  tag: text("tag"),
  mentions: integer("mentions").notNull().default(0),
  delta: text("delta"),
  severity: real("severity").notNull().default(0),
  summary: text("summary"),
  threads: integer("threads").notNull().default(0),
  sample: text("sample"),
  sort_order: integer("sort_order").notNull().default(0),
});

export const report_feature_gaps = pgTable("report_feature_gaps", {
  id: uuid("id").primaryKey().defaultRandom(),
  report_id: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  feature: text("feature").notNull(),
  votes: integer("votes").notNull().default(0),
  signal: real("signal").notNull().default(0),
  sort_order: integer("sort_order").notNull().default(0),
});

export const report_pricing_tiers = pgTable("report_pricing_tiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  report_id: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  tier: text("tier").notNull(),
  pain: real("pain").notNull().default(0),
  note: text("note"),
  sort_order: integer("sort_order").notNull().default(0),
});

export const report_pricing_quotes = pgTable("report_pricing_quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  report_id: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  who: text("who").notNull(),
  sub: text("sub"),
  text: text("text").notNull(),
  sort_order: integer("sort_order").notNull().default(0),
});

export const switching_direction_enum = pgEnum("switching_direction", ["inbound", "outbound"]);

export const report_switching = pgTable("report_switching", {
  id: uuid("id").primaryKey().defaultRandom(),
  report_id: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  direction: switching_direction_enum("direction").notNull(),
  competitor_name: text("competitor_name").notNull(),
  count: integer("count").notNull().default(0),
  share: real("share").notNull().default(0),
  sort_order: integer("sort_order").notNull().default(0),
});

export const report_quotes = pgTable("report_quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  report_id: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  who: text("who").notNull(),
  sub: text("sub"),
  when_label: text("when_label"),
  score: integer("score").notNull().default(0),
  sentiment: real("sentiment"),
  text: text("text").notNull(),
  sort_order: integer("sort_order").notNull().default(0),
});

export const voice_word_kind_enum = pgEnum("voice_word_kind", ["positive", "negative"]);

export const report_voice_words = pgTable("report_voice_words", {
  id: uuid("id").primaryKey().defaultRandom(),
  report_id: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  kind: voice_word_kind_enum("kind").notNull(),
  word: text("word").notNull(),
  count: integer("count").notNull().default(0),
  sort_order: integer("sort_order").notNull().default(0),
});

export const report_positioning = pgTable("report_positioning", {
  id: uuid("id").primaryKey().defaultRandom(),
  report_id: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  angle: text("angle").notNull(),
  thesis: text("thesis"),
  audience: text("audience"),
  against: text("against"),
  sort_order: integer("sort_order").notNull().default(0),
});

export const effort_enum = pgEnum("effort_level", ["low", "med", "high"]);
export const payoff_enum = pgEnum("payoff_level", ["low", "med", "high"]);

export const report_actions = pgTable("report_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  report_id: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  step: text("step").notNull(),
  detail: text("detail"),
  effort: effort_enum("effort").notNull().default("med"),
  role: text("role"),
  sort_order: integer("sort_order").notNull().default(0),
});

export const report_leads = pgTable("report_leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  report_id: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  who: text("who").notNull(),
  sub: text("sub"),
  when_label: text("when_label"),
  score: integer("score").notNull().default(0),
  signal: text("signal"),
  quote: text("quote"),
  sort_order: integer("sort_order").notNull().default(0),
});

export const report_opportunities = pgTable("report_opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  report_id: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  thesis: text("thesis"),
  effort: effort_enum("effort").notNull().default("med"),
  payoff: payoff_enum("payoff").notNull().default("med"),
  anchor_complaint_external_id: text("anchor_complaint_external_id"),
  sort_order: integer("sort_order").notNull().default(0),
});

export const report_threads = pgTable("report_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  report_id: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  complaint_external_id: text("complaint_external_id"),
  platform: text("platform").notNull(),
  url: text("url"),
  title: text("title").notNull(),
  author: text("author"),
  sub: text("sub"),
  posted_at: timestamp("posted_at"),
  score: integer("score").notNull().default(0),
  sort_order: integer("sort_order").notNull().default(0),
});

export const report_thread_messages = pgTable("report_thread_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  thread_id: uuid("thread_id")
    .notNull()
    .references(() => report_threads.id, { onDelete: "cascade" }),
  author: text("author"),
  body: text("body").notNull(),
  posted_at: timestamp("posted_at"),
  score: integer("score").notNull().default(0),
  sort_order: integer("sort_order").notNull().default(0),
});

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type ReportComplaint = typeof report_complaints.$inferSelect;
export type ReportFeatureGap = typeof report_feature_gaps.$inferSelect;
export type ReportPricingTier = typeof report_pricing_tiers.$inferSelect;
export type ReportPricingQuote = typeof report_pricing_quotes.$inferSelect;
export type ReportSwitching = typeof report_switching.$inferSelect;
export type ReportQuote = typeof report_quotes.$inferSelect;
export type ReportVoiceWord = typeof report_voice_words.$inferSelect;
export type ReportPositioning = typeof report_positioning.$inferSelect;
export type ReportAction = typeof report_actions.$inferSelect;
export type ReportLead = typeof report_leads.$inferSelect;
export type ReportOpportunity = typeof report_opportunities.$inferSelect;
export type ReportThread = typeof report_threads.$inferSelect;
export type ReportThreadMessage = typeof report_thread_messages.$inferSelect;
export type ReportPlatformStat = typeof report_platform_stats.$inferSelect;
export type ReportSubreddit = typeof report_subreddits.$inferSelect;
