import { Elysia } from "elysia";
import { listReports } from "./handlers/list-reports";
import { createReport } from "./handlers/create-report";
import { getReport } from "./handlers/get-report";

export const reportsController = new Elysia({
  prefix: "/reports",
  tags: ["reports"],
})
  .use(listReports)
  .use(createReport)
  .use(getReport);
