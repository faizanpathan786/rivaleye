import { Elysia } from "elysia";
import { getDashboardHandler } from "./handlers/getDashboard";

export const dashboardController = new Elysia({
  prefix: "/dashboard",
  tags: ["dashboard"],
}).use(getDashboardHandler);
