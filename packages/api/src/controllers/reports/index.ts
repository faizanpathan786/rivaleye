import { Elysia } from "elysia";
import { listReportsHandler } from "./handlers/listReports";
import { createReportHandler } from "./handlers/createReport";
import { getReportHandler } from "./handlers/getReport";
import { getProgressHandler } from "./handlers/getProgress";
import { getComplaintsHandler } from "./handlers/getComplaints";
import { getFeatureGapsHandler } from "./handlers/getFeatureGaps";
import { getPricingHandler } from "./handlers/getPricing";
import { getSwitchingHandler } from "./handlers/getSwitching";
import { getQuotesHandler } from "./handlers/getQuotes";
import { getVoiceHandler } from "./handlers/getVoice";
import { getPositioningHandler } from "./handlers/getPositioning";
import { getActionsHandler } from "./handlers/getActions";
import { getLeadsHandler } from "./handlers/getLeads";
import { getOpportunitiesHandler } from "./handlers/getOpportunities";
import { getPlatformsHandler } from "./handlers/getPlatforms";
import { getSubredditsHandler } from "./handlers/getSubreddits";
import { getSentimentSeriesHandler } from "./handlers/getSentimentSeries";
import { getThreadsHandler } from "./handlers/getThreads";
import { getThreadHandler } from "./handlers/getThread";
import { getLogsHandler } from "./handlers/getLogs";
import { retryPlatformHandler } from "./handlers/retryPlatform";
import { cancelHandler } from "./handlers/cancel";

export const reportsController = new Elysia({
  prefix: "/reports",
  tags: ["reports"],
})
  .use(listReportsHandler)
  .use(createReportHandler)
  .use(getProgressHandler)
  .use(getReportHandler)
  .use(getComplaintsHandler)
  .use(getFeatureGapsHandler)
  .use(getPricingHandler)
  .use(getSwitchingHandler)
  .use(getQuotesHandler)
  .use(getVoiceHandler)
  .use(getPositioningHandler)
  .use(getActionsHandler)
  .use(getLeadsHandler)
  .use(getOpportunitiesHandler)
  .use(getPlatformsHandler)
  .use(getSubredditsHandler)
  .use(getSentimentSeriesHandler)
  .use(getThreadsHandler)
  .use(getThreadHandler)
  .use(getLogsHandler)
  .use(retryPlatformHandler)
  .use(cancelHandler);
