import { pgTable, uuid, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { competitors } from "./competitors.js";
import { mentions } from "./mentions.js";

export const competitorMentions = pgTable(
  "competitor_mentions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitorId: uuid("competitor_id")
      .notNull()
      .references(() => competitors.id, { onDelete: "cascade" }),
    mentionId: uuid("mention_id")
      .notNull()
      .references(() => mentions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueCompetitorMention: uniqueIndex("idx_competitor_mentions_unique").on(
      table.competitorId,
      table.mentionId
    ),
  })
);

export type CompetitorMention = typeof competitorMentions.$inferSelect;
export type NewCompetitorMention = typeof competitorMentions.$inferInsert;
