import { helmet } from "elysia-helmet";

export const helmetPlugin = helmet({
  contentSecurityPolicy: false,
});
