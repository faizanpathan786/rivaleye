import { Elysia } from "elysia";

export const listReports = new Elysia().get("/", async () => {
  return { reports: [] };
});
