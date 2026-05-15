import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { controllers } from "./controllers";

const port = Number(process.env.PORT ?? 6090);

const app = new Elysia()
  .use(cors())
  .use(swagger({ path: "/docs" }))
  .get("/health", () => ({ ok: true }))
  .use(controllers)
  .listen(port);

console.log(`RivalEye API listening on http://localhost:${port}`);

export type App = typeof app;
