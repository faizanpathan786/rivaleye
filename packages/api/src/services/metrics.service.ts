import { and, avg, count, eq, gte, lte, max, min, sql, sum } from "drizzle-orm";
import { db } from "@/db/client";
import { report_platform_jobs, report_pdf_jobs, synthesis_jobs } from "@/db/schema/pipeline";
import { llm_usage, worker_heartbeats } from "@/db/schema/ops";
import { reports } from "@/db/schema/reports";

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

export const WORKER_DEAD_THRESHOLD_SECONDS = Number(
  process.env.WORKER_DEAD_THRESHOLD_SECONDS ?? 40,
);

// pm2 role names as configured in ecosystem.config.cjs (`rivaleye-scrape` /
// `rivaleye-synth`). report_pdf_jobs is rendered by the synth process too —
// there is no dedicated pdf worker. Update this map if worker roles change.
const QUEUE_ROLES: Record<"platform" | "synthesis" | "pdf", string[]> = {
  platform: ["scrape"],
  synthesis: ["synth"],
  pdf: ["synth"],
};

export type JobTableMetrics = {
  by_status_24h: Record<string, number>;
  running: number;
  oldest_queued_seconds: number | null;
};

export type QueueMetrics = {
  platform: JobTableMetrics;
  synthesis: JobTableMetrics;
  pdf: JobTableMetrics;
};

export type WorkerRow = {
  worker_id: string;
  role: string;
  seconds_since_heartbeat: number;
  in_flight: number;
  alive: boolean;
};

export type WorkerMetrics = {
  rows: WorkerRow[];
  alive_by_role: Record<string, number>;
};

export type LlmWindowMetrics = {
  total_calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  est_cost_usd: number;
  avg_latency_ms: number | null;
};

export type LlmMetrics = {
  last_hour: LlmWindowMetrics;
  last_24h: LlmWindowMetrics;
  cost_by_model_24h: Record<string, number>;
};

export type ReportMetrics = {
  by_status_24h: Record<string, number>;
  running: number;
};

export type MetricsSnapshot = {
  generated_at: string;
  queue: QueueMetrics;
  workers: WorkerMetrics;
  llm: LlmMetrics;
  reports: ReportMetrics;
};

type JobTable = typeof report_platform_jobs | typeof synthesis_jobs | typeof report_pdf_jobs;

async function getJobTableMetrics(table: JobTable, since: Date): Promise<JobTableMetrics> {
  const [statusRows, [runningRow], [oldestRow]] = await Promise.all([
    db
      .select({ status: table.status, value: count() })
      .from(table)
      .where(gte(table.created_at, since))
      .groupBy(table.status),
    db.select({ value: count() }).from(table).where(eq(table.status, "running")),
    db
      .select({ oldest: min(table.created_at) })
      .from(table)
      .where(and(eq(table.status, "queued"), lte(table.run_after, sql`now()`))),
  ]);

  const by_status_24h: Record<string, number> = {};
  for (const row of statusRows) {
    by_status_24h[row.status] = Number(row.value);
  }

  const oldest = oldestRow?.oldest ?? null;
  const oldest_queued_seconds =
    oldest === null ? null : Math.floor((Date.now() - new Date(oldest).getTime()) / 1000);

  return {
    by_status_24h,
    running: Number(runningRow?.value ?? 0),
    oldest_queued_seconds,
  };
}

export async function getQueueMetrics(): Promise<QueueMetrics> {
  const since = new Date(Date.now() - ONE_DAY_MS);
  const [platform, synthesis, pdf] = await Promise.all([
    getJobTableMetrics(report_platform_jobs, since),
    getJobTableMetrics(synthesis_jobs, since),
    getJobTableMetrics(report_pdf_jobs, since),
  ]);
  return { platform, synthesis, pdf };
}

export async function getWorkerMetrics(): Promise<WorkerMetrics> {
  const heartbeats = await db
    .select({
      worker_id: worker_heartbeats.worker_id,
      role: worker_heartbeats.role,
      last_seen_at: worker_heartbeats.last_seen_at,
      in_flight: worker_heartbeats.in_flight,
    })
    .from(worker_heartbeats);

  const now = Date.now();
  const rows: WorkerRow[] = heartbeats.map((h) => {
    const seconds_since_heartbeat = Math.floor(
      (now - new Date(h.last_seen_at).getTime()) / 1000,
    );
    return {
      worker_id: h.worker_id,
      role: h.role,
      seconds_since_heartbeat,
      in_flight: h.in_flight,
      alive: seconds_since_heartbeat <= WORKER_DEAD_THRESHOLD_SECONDS,
    };
  });

  const alive_by_role: Record<string, number> = {};
  for (const row of rows) {
    if (!row.alive) continue;
    alive_by_role[row.role] = (alive_by_role[row.role] ?? 0) + 1;
  }

  return { rows, alive_by_role };
}

// True when a queue's backlog is old AND every worker role that would process
// it (per QUEUE_ROLES) has zero alive instances — a genuinely dead-worker
// state, not just a busy/backlogged live worker.
export function isQueueOrphaned(
  queueKey: keyof typeof QUEUE_ROLES,
  queue: JobTableMetrics,
  workers: WorkerMetrics,
  staleAfterSeconds: number,
): boolean {
  if (queue.oldest_queued_seconds === null) return false;
  if (queue.oldest_queued_seconds <= staleAfterSeconds) return false;

  const roles = QUEUE_ROLES[queueKey];
  const aliveForAnyRole = roles.some((role) => (workers.alive_by_role[role] ?? 0) > 0);
  return !aliveForAnyRole;
}

async function getLlmWindowMetrics(since: Date): Promise<LlmWindowMetrics> {
  const [row] = await db
    .select({
      total_calls: count(),
      prompt_tokens: sum(llm_usage.prompt_tokens),
      completion_tokens: sum(llm_usage.completion_tokens),
      est_cost_usd: sum(llm_usage.est_cost_usd),
      avg_latency_ms: avg(llm_usage.latency_ms),
    })
    .from(llm_usage)
    .where(gte(llm_usage.created_at, since));

  return {
    total_calls: Number(row?.total_calls ?? 0),
    prompt_tokens: Number(row?.prompt_tokens ?? 0),
    completion_tokens: Number(row?.completion_tokens ?? 0),
    est_cost_usd: Number(row?.est_cost_usd ?? 0),
    avg_latency_ms: row?.avg_latency_ms === null || row?.avg_latency_ms === undefined
      ? null
      : Number(row.avg_latency_ms),
  };
}

export async function getLlmMetrics(): Promise<LlmMetrics> {
  const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS);
  const oneDayAgo = new Date(Date.now() - ONE_DAY_MS);

  const [last_hour, last_24h, costByModelRows] = await Promise.all([
    getLlmWindowMetrics(oneHourAgo),
    getLlmWindowMetrics(oneDayAgo),
    db
      .select({ model: llm_usage.model, value: sum(llm_usage.est_cost_usd) })
      .from(llm_usage)
      .where(gte(llm_usage.created_at, oneDayAgo))
      .groupBy(llm_usage.model),
  ]);

  const cost_by_model_24h: Record<string, number> = {};
  for (const row of costByModelRows) {
    cost_by_model_24h[row.model] = Number(row.value ?? 0);
  }

  return { last_hour, last_24h, cost_by_model_24h };
}

export async function getReportMetrics(): Promise<ReportMetrics> {
  const since = new Date(Date.now() - ONE_DAY_MS);
  const [statusRows, [runningRow]] = await Promise.all([
    db
      .select({ status: reports.status, value: count() })
      .from(reports)
      .where(gte(reports.created_at, since))
      .groupBy(reports.status),
    db.select({ value: count() }).from(reports).where(eq(reports.status, "running")),
  ]);

  const by_status_24h: Record<string, number> = {};
  for (const row of statusRows) {
    by_status_24h[row.status] = Number(row.value);
  }

  return { by_status_24h, running: Number(runningRow?.value ?? 0) };
}

export async function getMetricsSnapshot(): Promise<MetricsSnapshot> {
  const [queue, workers, llm, reportsMetrics] = await Promise.all([
    getQueueMetrics(),
    getWorkerMetrics(),
    getLlmMetrics(),
    getReportMetrics(),
  ]);

  return {
    generated_at: new Date().toISOString(),
    queue,
    workers,
    llm,
    reports: reportsMetrics,
  };
}

export function formatPrometheus(snapshot: MetricsSnapshot): string {
  const lines: string[] = [];

  const push = (help: string, type: string, name: string) => {
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} ${type}`);
  };

  push("Number of jobs by table and status in the last 24h", "gauge", "queue_depth");
  for (const [table, metrics] of Object.entries(snapshot.queue) as [
    keyof QueueMetrics,
    JobTableMetrics,
  ][]) {
    for (const [status, value] of Object.entries(metrics.by_status_24h)) {
      lines.push(`queue_depth{table="${table}",status="${status}"} ${value}`);
    }
  }

  push("Age in seconds of the oldest eligible queued job", "gauge", "oldest_queued_seconds");
  for (const [table, metrics] of Object.entries(snapshot.queue) as [
    keyof QueueMetrics,
    JobTableMetrics,
  ][]) {
    lines.push(`oldest_queued_seconds{table="${table}"} ${metrics.oldest_queued_seconds ?? 0}`);
  }

  push("1 if at least one worker of a role is alive, else 0", "gauge", "worker_alive");
  const roles = new Set(snapshot.workers.rows.map((r) => r.role));
  for (const role of roles) {
    const alive = (snapshot.workers.alive_by_role[role] ?? 0) > 0 ? 1 : 0;
    lines.push(`worker_alive{role="${role}"} ${alive}`);
  }

  push("Estimated LLM spend (USD) in the last hour", "gauge", "llm_cost_usd_1h");
  lines.push(`llm_cost_usd_1h ${snapshot.llm.last_hour.est_cost_usd}`);

  push("Total LLM tokens (prompt+completion) in the last hour", "gauge", "llm_tokens_1h");
  lines.push(
    `llm_tokens_1h ${snapshot.llm.last_hour.prompt_tokens + snapshot.llm.last_hour.completion_tokens}`,
  );

  return lines.join("\n") + "\n";
}
