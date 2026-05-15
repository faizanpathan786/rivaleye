import {
  pgTable,
  uuid,
  varchar,
  boolean,
  real,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { mentions } from "./mentions.js";

export const sentimentEnum = pgEnum("sentiment", ["positive", "negative", "neutral", "mixed"]);
export const categoryEnum = pgEnum("category", [
  "complaint",
  "praise",
  "feature_request",
  "comparison",
  "pricing",
  "ux",
  "performance",
  "support",
  "competitor_update",
  "other",
]);
export const urgencyEnum = pgEnum("urgency", ["low", "medium", "high"]);

export const classifications = pgTable("classifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  mentionId: uuid("mention_id")
    .notNull()
    .unique()
    .references(() => mentions.id, { onDelete: "cascade" }),
  sentiment: sentimentEnum("sentiment").notNull(),
  category: categoryEnum("category").notNull(),
  switchIntent: boolean("switch_intent").notNull().default(false),
  switchIntentTarget: varchar("switch_intent_target", { length: 255 }),
  featureShipped: varchar("feature_shipped", { length: 500 }),
  urgency: urgencyEnum("urgency").notNull(),
  competitorMentions: text("competitor_mentions").array().notNull().default([]),
  summary: text("summary").notNull(),
  confidence: real("confidence").notNull(),
  relevanceScore: real("relevance_score").notNull().default(100),
  isRelevant: boolean("is_relevant").notNull().default(true),
  classifiedAt: timestamp("classified_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Classification = typeof classifications.$inferSelect;
export type NewClassification = typeof classifications.$inferInsert;
