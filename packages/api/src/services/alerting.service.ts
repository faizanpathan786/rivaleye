import pino from "pino";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  getMetricsSnapshot,
  isQueueOrphaned,
  type MetricsSnapshot,
  type QueueMetrics,
} from "@/services/metrics.service";

const ALERT_INTERVAL_SECONDS = Number(process.env.ALERT_INTERVAL_SECONDS ?? 120);
const ALERT_QUEUE_AGE_SECONDS = Number(process.env.ALERT_QUEUE_AGE_SECONDS ?? 900);
const ALERT_LLM_COST_1H_USD = Number(process.env.ALERT_LLM_COST_1H_USD ?? 5);
const ALERT_COOLDOWN_SECONDS = Number(process.env.ALERT_COOLDOWN_SECONDS ?? 1800);
const ALERT_EMAIL = process.env.ALERT_EMAIL ?? "affan.momin@wednesday.is";

const logger = pino({ name: "alerting" });

type AlertCondition = {
  key: string;
  message: string;
  details?: Record<string, unknown>;
};

// last-fired timestamp (ms) per condition key, in-memory only — resets on
// process restart, which is fine since a restart itself clears the underlying
// condition in most cases (or will re-fire after one cooldown window).
const lastFiredAt = new Map<string, number>();

function isOnCooldown(key: string): boolean {
  const last = lastFiredAt.get(key);
  if (last === undefined) return false;
  return Date.now() - last < ALERT_COOLDOWN_SECONDS * 1000;
}

function markFired(key: string): void {
  lastFiredAt.set(key, Date.now());
}

async function sendAlertEmail(condition: AlertCondition): Promise<void> {
  const smtpConfigured =
    !!process.env.SMTP_HOST &&
    !!process.env.SMTP_PORT &&
    !!process.env.SMTP_USER &&
    !!process.env.SMTP_PASS &&
    !!process.env.SMTP_FROM;

  // TODO: nodemailer is not currently a dependency of @rivaleye/api. Once it
  // (or an equivalent SMTP/Slack client) is added, replace this branch with an
  // actual `transporter.sendMail(...)` / Slack webhook POST call using the
  // SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM env vars already read
  // above — everything else (de-dupe, cooldown, condition evaluation) is
  // already wired, so this is a one-liner swap.
  logger.error(
    {
      alert: true,
      condition: condition.key,
      to: ALERT_EMAIL,
      smtp_configured: smtpConfigured,
      delivered: false,
      ...condition.details,
    },
    condition.message,
  );
}

async function fireIfDue(condition: AlertCondition): Promise<void> {
  if (isOnCooldown(condition.key)) return;
  markFired(condition.key);
  await sendAlertEmail(condition);
}

async function isDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

function evaluateQueueConditions(
  snapshot: MetricsSnapshot,
): AlertCondition[] {
  const conditions: AlertCondition[] = [];
  const queueEntries = Object.entries(snapshot.queue) as [
    keyof QueueMetrics,
    QueueMetrics[keyof QueueMetrics],
  ][];

  for (const [queueKey, metrics] of queueEntries) {
    if (
      metrics.oldest_queued_seconds !== null &&
      metrics.oldest_queued_seconds > ALERT_QUEUE_AGE_SECONDS
    ) {
      conditions.push({
        key: `queue_backlog_age:${queueKey}`,
        message: `${queueKey} queue has a job waiting ${metrics.oldest_queued_seconds}s (> ${ALERT_QUEUE_AGE_SECONDS}s threshold)`,
        details: { queue: queueKey, oldest_queued_seconds: metrics.oldest_queued_seconds },
      });
    }

    if (isQueueOrphaned(queueKey, metrics, snapshot.workers, ALERT_QUEUE_AGE_SECONDS)) {
      conditions.push({
        key: `dead_worker_backlog:${queueKey}`,
        message: `${queueKey} queue has an old backlog and zero alive workers of the responsible role`,
        details: { queue: queueKey, oldest_queued_seconds: metrics.oldest_queued_seconds },
      });
    }
  }

  return conditions;
}

export async function checkAndAlert(): Promise<void> {
  try {
    const dbReachable = await isDbReachable();
    if (!dbReachable) {
      await fireIfDue({ key: "db_unreachable", message: "Database is unreachable from the API" });
      return;
    }

    const snapshot = await getMetricsSnapshot();

    const conditions: AlertCondition[] = [...evaluateQueueConditions(snapshot)];

    if (snapshot.llm.last_hour.est_cost_usd > ALERT_LLM_COST_1H_USD) {
      conditions.push({
        key: "llm_cost_1h",
        message: `LLM spend in the last hour is $${snapshot.llm.last_hour.est_cost_usd.toFixed(2)} (> $${ALERT_LLM_COST_1H_USD} threshold)`,
        details: { est_cost_usd: snapshot.llm.last_hour.est_cost_usd },
      });
    }

    for (const condition of conditions) {
      await fireIfDue(condition);
    }
  } catch (e) {
    // A transient failure in the alert check itself must never crash the api
    // process or the interval loop.
    logger.error({ err: e instanceof Error ? e.message : String(e) }, "checkAndAlert failed");
  }
}

let alertLoopHandle: ReturnType<typeof setInterval> | null = null;

export function startAlertLoop(): void {
  if (alertLoopHandle) return;

  logger.info(
    { interval_seconds: ALERT_INTERVAL_SECONDS },
    "starting alert loop",
  );

  alertLoopHandle = setInterval(() => {
    void checkAndAlert();
  }, ALERT_INTERVAL_SECONDS * 1000);

  // Don't hold the process open solely for this timer (relevant for scripts/tests).
  alertLoopHandle.unref?.();
}

export function stopAlertLoop(): void {
  if (!alertLoopHandle) return;
  clearInterval(alertLoopHandle);
  alertLoopHandle = null;
}
