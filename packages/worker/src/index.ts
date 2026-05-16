import { boss, QUEUES } from "./queue";
import type { ScrapePlatformJob, GenerateReportJob } from "./queue";
import { handleScrapePlatform } from "./jobs/scrape-platform";
import { handleGenerateReport } from "./jobs/generate-report";

async function main() {
  await boss.start();

  // 5 independent workers registered for the same queue — pg-boss v10 supports this.
  // Each handles one job at a time; if the handler throws, only that job is retried.
  for (let i = 0; i < 5; i++) {
    await boss.work<ScrapePlatformJob>(
      QUEUES.scrapePlatform,
      { batchSize: 1 },
      async (jobs) => {
        await handleScrapePlatform(jobs[0]!.data);
      },
    );
  }

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
