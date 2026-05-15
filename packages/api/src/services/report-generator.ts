import { ALL_PLATFORMS, type PlatformId } from "@rivaleye/scrapers";
import { enqueueScrapePlatform } from "../libs/queue";

export interface StartReportInput {
  reportId: string;
  category: string;
  competitors: string[];
  platforms?: PlatformId[];
}

export async function startReport(input: StartReportInput) {
  const platforms = input.platforms ?? ALL_PLATFORMS;
  const jobs = platforms.flatMap((platform) =>
    input.competitors.map((competitor) =>
      enqueueScrapePlatform({
        reportId: input.reportId,
        platform,
        competitor,
        category: input.category,
      }),
    ),
  );
  await Promise.all(jobs);
  return { enqueued: jobs.length };
}
