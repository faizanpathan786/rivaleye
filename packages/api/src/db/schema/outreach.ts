import {
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { reports } from "./reports";

export const outreach_items = pgTable(
  "outreach_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    owner_id: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    report_id: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    pricing_issue: text("pricing_issue"),
    plan_limitation: text("plan_limitation"),
    team_size_hint: text("team_size_hint"),
    budget_sensitivity: text("budget_sensitivity"),
    alternative_interest: text("alternative_interest"),
    suggested_pricing_angle: text("suggested_pricing_angle"),
    source_url: text("source_url"),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("outreach_items_owner_report_title_uniq").on(
      t.owner_id,
      t.report_id,
      t.title,
    ),
    index("outreach_items_owner_id_idx").on(t.owner_id),
  ],
);

export type OutreachItem = typeof outreach_items.$inferSelect;
export type NewOutreachItem = typeof outreach_items.$inferInsert;
