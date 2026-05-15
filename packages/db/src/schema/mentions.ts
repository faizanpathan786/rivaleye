import { pgTable, uuid, varchar, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const mentionSourceEnum = pgEnum("mention_source", ["reddit"]);
export const mentionPostTypeEnum = pgEnum("mention_post_type", ["post", "comment"]);

export const mentions = pgTable("mentions", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: mentionSourceEnum("source").notNull(),
  // Deduplication key — Reddit post/comment ID prefixed with source
  externalId: varchar("external_id", { length: 255 }).notNull().unique(),
  author: varchar("author", { length: 255 }).notNull(),
  content: text("content").notNull(),
  url: varchar("url", { length: 1000 }).notNull(),
  score: integer("score").notNull().default(0),
  numComments: integer("num_comments").notNull().default(0),
  subreddit: varchar("subreddit", { length: 255 }),
  postType: mentionPostTypeEnum("post_type").notNull(),
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Mention = typeof mentions.$inferSelect;
export type NewMention = typeof mentions.$inferInsert;
