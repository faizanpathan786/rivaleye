import { Queue } from "bullmq";
import { config } from "./config.js";

const connection = { url: config.redisUrl };

export const classificationQueue = new Queue("classification", { connection });
export const clusteringQueue = new Queue("clustering", { connection });

export async function enqueueClassification(competitorId: string, mentionIds: string[]) {
  await classificationQueue.add(
    "classify",
    { competitorId, mentionIds },
    { attempts: 3, backoff: { type: "exponential", delay: 5_000 } },
  );
}

export async function enqueueClustering(competitorId: string) {
  await clusteringQueue.add(
    "cluster",
    { competitorId },
    { jobId: `cluster-${competitorId}`, attempts: 3, backoff: { type: "exponential", delay: 5_000 } },
  );
}
