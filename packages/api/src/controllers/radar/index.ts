import { Elysia } from "elysia";
import { listRadarEventsHandler } from "./handlers/listEvents";
import { getRadarEventHandler } from "./handlers/getEvent";

export const radarController = new Elysia({
  prefix: "/radar",
  tags: ["radar"],
})
  .use(listRadarEventsHandler)
  .use(getRadarEventHandler);
