import { Elysia } from "elysia";
import { corsPlugin } from "./config/cors";
import { helmetPlugin } from "./config/helmet";
import { loggerPlugin } from "./config/logger";
import { swaggerPlugin } from "./config/swagger";
import { sql } from "drizzle-orm";
import { controllers } from "./controllers";
import { auth } from "./libs/auth";
import { db } from "./db/client";

const port = Number(process.env.PORT ?? 4000);

export const app = new Elysia()
  .use(corsPlugin)
  .mount("/v1/auth", auth.handler)
  .use(swaggerPlugin)
  .use(helmetPlugin)
  // Readiness probe: confirm the process can actually reach Postgres, not just
  // that the HTTP server is up. Returns 503 when the DB is unreachable.
  .get("/health", async ({ status }) => {
    try {
      await db.execute(sql`select 1`);
      return { ok: true, db: "up" };
    } catch {
      return status(503, { ok: false, db: "down" });
    }
  })
  .use(controllers)
  .listen(port);

console.log(`RivalEye API listening on ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
