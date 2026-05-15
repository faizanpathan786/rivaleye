import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { reports } from "./reports";

export const mentions = pgTable(
  "mentions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    author: text("author"),
    title: text("title"),
    body: text("body").notNull(),
    score: integer("score"),
    numComments: integer("num_comments"),
    postedAt: timestamp("posted_at").notNull(),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("mentions_report_platform_external_uniq").on(
      t.reportId,
      t.platform,
      t.externalId,
    ),
    index("mentions_report_id_idx").on(t.reportId),
  ],
);

export type Mention = typeof mentions.$inferSelect;
export type NewMention = typeof mentions.$inferInsert;
