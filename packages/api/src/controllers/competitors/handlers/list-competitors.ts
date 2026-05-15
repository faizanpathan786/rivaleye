import { Elysia } from "elysia";

export const listCompetitors = new Elysia().get("/", async () => {
  return { competitors: [] };
});
