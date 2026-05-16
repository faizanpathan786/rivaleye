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
    report_id: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    external_id: text("external_id").notNull(),
    url: text("url").notNull(),
    author: text("author"),
    title: text("title"),
    body: text("body").notNull(),
    score: integer("score"),
    num_comments: integer("num_comments"),
    posted_at: timestamp("posted_at").notNull(),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("mentions_report_platform_external_uniq").on(
      t.report_id,
      t.platform,
      t.external_id,
    ),
    index("mentions_report_id_idx").on(t.report_id),
  ],
);

export type Mention = typeof mentions.$inferSelect;
export type NewMention = typeof mentions.$inferInsert;
