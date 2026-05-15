import { pgTable, uuid, varchar, boolean, timestamp, text } from "drizzle-orm/pg-core";
import { competitors } from "./competitors.js";

export const redditSources = pgTable("reddit_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitorId: uuid("competitor_id")
    .notNull()
    .references(() => competitors.id, { onDelete: "cascade" }),
  subreddit: varchar("subreddit", { length: 255 }).notNull(),
  searchTerms: text("search_terms").array().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RedditSource = typeof redditSources.$inferSelect;
export type NewRedditSource = typeof redditSources.$inferInsert;
