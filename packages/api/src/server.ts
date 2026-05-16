import { Elysia } from "elysia";
import { corsPlugin } from "./config/cors";
import { helmetPlugin } from "./config/helmet";
import { loggerPlugin } from "./config/logger";
import { swaggerPlugin } from "./config/swagger";
import { controllers } from "./controllers";
import { auth } from "./libs/auth";

const port = Number(process.env.PORT ?? 3001);

export const app = new Elysia()
  .use(corsPlugin)
  .mount("/v1/auth", auth.handler)
  .use(swaggerPlugin)
  .use(helmetPlugin)
  .get("/health", () => ({ ok: true }))
  .use(controllers)
  .listen(port);

console.log(`RivalEye API listening on ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
