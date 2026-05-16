// MVP: anonymous report creation. authPlugin intentionally not applied.
// Re-introduce per packages/api/CLAUDE.md when user accounts ship.
import { Elysia } from "elysia";
import { createReport } from "./handlers/create-report";
import { getReport } from "./handlers/get-report";

export const reportsController = new Elysia({
  prefix: "/reports",
  tags: ["reports"],
})
  .use(createReport)
  .use(getReport);
