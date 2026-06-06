import { Elysia } from "elysia";
import { reportsController } from "./reports";
import { competitorsController } from "./competitors";
import { radarController } from "./radar";
import { meController } from "./users";
import { dashboardController } from "./dashboard";
import { billingController } from "./billing";
import { logoController } from "./logo";

export const controllers = new Elysia({ prefix: "/v1" })
  .use(reportsController)
  .use(competitorsController)
  .use(radarController)
  .use(meController)
  .use(dashboardController)
  .use(billingController)
  .use(logoController);
