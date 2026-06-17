import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { reports } from "./reports";

export const planned_actions = pgTable("planned_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  owner_id: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  report_id: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  role: text("role"),
  effort: text("effort"),
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type PlannedAction = typeof planned_actions.$inferSelect;
export type InsertPlannedAction = typeof planned_actions.$inferInsert;
