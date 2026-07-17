import {
  bigint,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { reports } from "./reports";

// Per-LLM-call cost/latency ledger. report_id is nullable because some calls
// (e.g. keyword-expansion) happen pre-report or standalone, outside any report.
export const llm_usage = pgTable(
  "llm_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    report_id: uuid("report_id").references(() => reports.id, { onDelete: "cascade" }),
    tag: text("tag"),
    model: text("model").notNull(),
    provider: text("provider").notNull().default("openrouter"),
    prompt_tokens: integer("prompt_tokens").notNull().default(0),
    completion_tokens: integer("completion_tokens").notNull().default(0),
    est_cost_usd: numeric("est_cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    latency_ms: integer("latency_ms"),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("llm_usage_report_id_idx").on(t.report_id),
    index("llm_usage_created_at_idx").on(t.created_at),
  ],
);

export type LlmUsage = typeof llm_usage.$inferSelect;
export type NewLlmUsage = typeof llm_usage.$inferInsert;

// Liveness signal for pm2-managed scrape/synth worker processes, backing the
// /health dead-worker check.
export const worker_heartbeats = pgTable(
  "worker_heartbeats",
  {
    worker_id: text("worker_id").primaryKey(),
    role: text("role").notNull(),
    last_seen_at: timestamp("last_seen_at").notNull().defaultNow(),
    in_flight: integer("in_flight").notNull().default(0),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("worker_heartbeats_last_seen_at_idx").on(t.last_seen_at)],
);

export type WorkerHeartbeat = typeof worker_heartbeats.$inferSelect;
export type NewWorkerHeartbeat = typeof worker_heartbeats.$inferInsert;

// Mirrors better-auth's built-in `rateLimit` model exactly (id, key, count,
// lastRequest) so it can be registered in the drizzleAdapter's `schema` map
// and storage flipped from "memory" to "database". Another agent wires this
// into packages/api/src/libs/auth.ts — this table only defines the shape.
export const rate_limit = pgTable(
  "rate_limit",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    count: integer("count").notNull().default(0),
    last_request: bigint("last_request", { mode: "number" }).notNull().default(0),
  },
  (t) => [index("rate_limit_key_idx").on(t.key)],
);

export type RateLimit = typeof rate_limit.$inferSelect;
export type NewRateLimit = typeof rate_limit.$inferInsert;
