import { Elysia } from "elysia";
import { listCompetitors } from "./handlers/list-competitors";

export const competitorsController = new Elysia({
  prefix: "/competitors",
  tags: ["competitors"],
}).use(listCompetitors);
