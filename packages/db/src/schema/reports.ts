import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { competitors } from "./competitors.js";

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitorId: uuid("competitor_id")
    .notNull()
    .references(() => competitors.id, { onDelete: "cascade" }),
  searchQuery: text("search_query").notNull(),
  status: text("status").notNull().default("pending"), // pending | processing | completed | failed
  reportData: jsonb("report_data").$type<{
    summary: string;
    painThemes: Array<{
      theme: string;
      category: string;
      mentionCount: number;
      quotes: Array<{
        mentionId: string;
        text: string;
        score: number;
        subreddit: string;
        author: string;
        url: string;
      }>;
      sentimentDistribution: {
        positive: number;
        negative: number;
        neutral: number;
        mixed: number;
      };
    }>;
    featureRequests: Array<{
      request: string;
      count: number;
      mentions: string[];
    }>;
    positioningOpportunity: string;
    validationSteps: string[];
    signalStrength: "weak" | "medium" | "strong";
    mentionCount: number;
  }>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
