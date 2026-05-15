import { Elysia } from "elysia";
import { reportsController } from "./reports";
import { competitorsController } from "./competitors";

export const controllers = new Elysia({ prefix: "/v1" })
  .use(reportsController)
  .use(competitorsController);
