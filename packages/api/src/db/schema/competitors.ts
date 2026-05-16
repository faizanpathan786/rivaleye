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

export const competitor_priority_enum = pgEnum("competitor_priority", [
  "primary",
  "secondary",
  "tertiary",
]);

export const monitor_sensitivity_enum = pgEnum("monitor_sensitivity", [
  "low",
  "med",
  "high",
]);

export type CompetitorSocials = {
  linkedin?: string;
  twitter?: string;
  github?: string;
  youtube?: string;
  producthunt?: string;
  blog?: string;
};

export const competitors = pgTable("competitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  owner_id: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  website: text("website"),
  category: text("category"),
  color: text("color"),
  priority: competitor_priority_enum("priority").notNull().default("secondary"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  socials: jsonb("socials").$type<CompetitorSocials>().notNull().default({}),
  monitor_enabled: boolean("monitor_enabled").notNull().default(true),
  monitor_sensitivity: monitor_sensitivity_enum("monitor_sensitivity")
    .notNull()
    .default("med"),
  monitor_watch: jsonb("monitor_watch").$type<string[]>().notNull().default([]),
  notes: text("notes"),
  stat_sentiment: real("stat_sentiment"),
  stat_mentions: integer("stat_mentions").notNull().default(0),
  stat_alerts_7d: integer("stat_alerts_7d").notNull().default(0),
  last_activity_at: timestamp("last_activity_at"),
  added_at: timestamp("added_at").notNull().defaultNow(),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export type Competitor = typeof competitors.$inferSelect;
export type NewCompetitor = typeof competitors.$inferInsert;
