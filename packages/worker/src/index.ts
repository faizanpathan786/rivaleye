import { boss, QUEUES } from "./queue";
import type { ScrapePlatformJob, GenerateReportJob } from "./queue";
import { handleScrapePlatform } from "./jobs/scrape-platform";
import { handleGenerateReport } from "./jobs/generate-report";

async function main() {
  await boss.start();

  await boss.work<ScrapePlatformJob>(
    QUEUES.scrapePlatform,
    { batchSize: 5 },
    async (jobs) => {
      await Promise.allSettled(jobs.map((job) => handleScrapePlatform(job.data)));
    },
  );

  await boss.work<GenerateReportJob>(
    QUEUES.generateReport,
    { batchSize: 1 },
    async (jobs) => {
      for (const job of jobs) await handleGenerateReport(job.data);
    },
  );

  console.log("RivalEye worker started");
}

main().catch((err) => {
  console.error("worker crashed", err);
  process.exit(1);
});
