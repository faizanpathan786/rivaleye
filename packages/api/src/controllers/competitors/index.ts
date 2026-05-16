import { Elysia } from "elysia";
import { listCompetitorsHandler } from "./handlers/listCompetitors";
import { createCompetitorHandler } from "./handlers/createCompetitor";
import { getCompetitorHandler } from "./handlers/getCompetitor";
import { updateCompetitorHandler } from "./handlers/updateCompetitor";
import { deleteCompetitorHandler } from "./handlers/deleteCompetitor";
import { listCompetitorEventsHandler } from "./handlers/listCompetitorEvents";

export const competitorsController = new Elysia({
  prefix: "/competitors",
  tags: ["competitors"],
})
  .use(listCompetitorsHandler)
  .use(createCompetitorHandler)
  .use(getCompetitorHandler)
  .use(updateCompetitorHandler)
  .use(deleteCompetitorHandler)
  .use(listCompetitorEventsHandler);
