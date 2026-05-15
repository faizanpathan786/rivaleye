import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const reportStatusEnum = pgEnum("report_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

export const reportGoalEnum = pgEnum("report_goal", [
  "validate_idea",
  "find_weaknesses",
  "improve_positioning",
  "decide_mvp_features",
  "find_user_pain",
  "compare_alternatives",
]);

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  competitors: jsonb("competitors").$type<string[]>().notNull(),
  audience: text("audience"),
  goal: reportGoalEnum("goal").notNull(),
  status: reportStatusEnum("status").notNull().default("queued"),
  output: jsonb("output").$type<Record<string, unknown> | null>().default(null),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
