import { Elysia } from "elysia";
import { reportsController } from "./reports";
import { competitorsController } from "./competitors";
import { radarController } from "./radar";
import { meController } from "./users";
import { dashboardController } from "./dashboard";
import { billingController } from "./billing";
import { logoController } from "./logo";
import { outreachController } from "./outreach";
import { plannedActionsController } from "./planned-actions";
import { metricsController } from "./metrics";

export const controllers = new Elysia({ prefix: "/v1" })
  .use(reportsController)
  .use(competitorsController)
  .use(radarController)
  .use(meController)
  .use(dashboardController)
  .use(billingController)
  .use(logoController)
  .use(outreachController)
  .use(plannedActionsController)
  .use(metricsController);
