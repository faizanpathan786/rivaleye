import { pgTable, uuid, varchar, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { competitors } from "./competitors.js";
import { mentions } from "./mentions.js";
import { sentimentEnum, categoryEnum } from "./classifications.js";

export const trendEnum = pgEnum("trend", ["rising", "falling", "stable"]);

export const clusters = pgTable("clusters", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitorId: uuid("competitor_id")
    .notNull()
    .references(() => competitors.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 500 }).notNull(),
  category: categoryEnum("category").notNull(),
  sentiment: sentimentEnum("sentiment").notNull(),
  mentionCount: integer("mention_count").notNull().default(0),
  trend: trendEnum("trend").notNull().default("stable"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clusterMentions = pgTable("cluster_mentions", {
  clusterId: uuid("cluster_id")
    .notNull()
    .references(() => clusters.id, { onDelete: "cascade" }),
  mentionId: uuid("mention_id")
    .notNull()
    .references(() => mentions.id, { onDelete: "cascade" }),
});

export type Cluster = typeof clusters.$inferSelect;
export type NewCluster = typeof clusters.$inferInsert;
