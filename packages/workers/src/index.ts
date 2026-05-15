import { Worker, type Job } from "bullmq";
import { Queue } from "bullmq";
import { processIngestion } from "./processors/ingestion.processor.js";
import { processClassification } from "./processors/classification.processor.js";
import { processClustering } from "./processors/clustering.processor.js";
import { processReportGeneration } from "./processors/report.processor.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { db, competitors } from "@rivaleye/db";
import { eq } from "drizzle-orm";

const connection = { url: config.redisUrl };

// ─── Queue definitions ────────────────────────────────────────────────────────

const ingestionQueue = new Queue("ingestion", { connection });
const classificationQueue = new Queue("classification", { connection });
const clusteringQueue = new Queue("clustering", { connection });
const reportQueue = new Queue("report", { connection });

// ─── Workers ──────────────────────────────────────────────────────────────────

const ingestionWorker = new Worker(
  "ingestion",
  async (job: Job<{ competitorId: string }>) => {
    logger.info({ jobId: job.id, competitorId: job.data.competitorId }, "Processing ingestion job");
    await processIngestion(job.data.competitorId);
    // Classification is now enqueued directly by processIngestion with proper mentionIds
  },
  { connection, concurrency: 2, lockDuration: 600_000 }, // 10 min lock for slow Reddit API calls
);

const classificationWorker = new Worker(
  "classification",
  async (job: Job<{ competitorId: string; mentionIds?: string[] }>) => {
    logger.info({ jobId: job.id, competitorId: job.data.competitorId }, "Processing classification job");
    await processClassification(job.data.competitorId, job.data.mentionIds);

    // Chain: after classification → clustering
    await clusteringQueue.add(
      "cluster",
      { competitorId: job.data.competitorId },
      { jobId: `cluster-${job.data.competitorId}`, attempts: 3, backoff: { type: "exponential", delay: 5_000 } },
    );
  },
  { connection, concurrency: 1, lockDuration: 600_000, maxStalledCount: 2 }, // 10 min lock for LLM inference
);

const clusteringWorker = new Worker(
  "clustering",
  async (job: Job<{ competitorId: string }>) => {
    logger.info({ jobId: job.id, competitorId: job.data.competitorId }, "Processing clustering job");
    await processClustering(job.data.competitorId);

    // Chain: after clustering → report generation
    await reportQueue.add(
      "generate",
      { competitorId: job.data.competitorId },
      { jobId: `report-${job.data.competitorId}`, attempts: 3, backoff: { type: "exponential", delay: 5_000 } },
    );
  },
  { connection, concurrency: 2 },
);

const reportWorker = new Worker(
  "report",
  async (job: Job<{ competitorId: string }>) => {
    logger.info({ jobId: job.id, competitorId: job.data.competitorId }, "Processing report generation job");
    await processReportGeneration(job.data.competitorId);
  },
  { connection, concurrency: 2 },
);

// ─── Error handling ───────────────────────────────────────────────────────────

for (const worker of [ingestionWorker, classificationWorker, clusteringWorker, reportWorker]) {
  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, `Worker ${worker.name} job failed`);
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, `Worker ${worker.name} job completed`);
  });
}

// ─── 24h Cron Scheduler ───────────────────────────────────────────────────────

async function scheduleDailyIngestion() {
  logger.info("Running daily ingestion scheduler");

  try {
    const activeCompetitors = await db
      .select()
      .from(competitors)
      .where(eq(competitors.status, "active"));

    logger.info({ count: activeCompetitors.length }, "Scheduling ingestion for active competitors");

    for (const competitor of activeCompetitors) {
      await ingestionQueue.add(
        "ingest",
        { competitorId: competitor.id },
        {
          jobId: `cron-ingest-${competitor.id}-${new Date().toISOString().slice(0, 10)}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 10_000 },
        },
      );
    }
  } catch (err) {
    logger.error({ err }, "Daily scheduler failed");
  }
}

// Run immediately on startup, then every 24 hours
await scheduleDailyIngestion();
setInterval(scheduleDailyIngestion, 24 * 60 * 60 * 1000);

logger.info("RivalEye workers running");

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("Shutting down workers...");
  await ingestionWorker.close();
  await classificationWorker.close();
  await clusteringWorker.close();
  await reportWorker.close();
  process.exit(0);
});
