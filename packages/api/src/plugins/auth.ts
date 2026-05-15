import { Elysia } from "elysia";

export const authPlugin = new Elysia({ name: "auth-plugin" })
  .derive(async ({ headers }) => {
    const authHeader = headers.authorization;
    return { session: null as null, user: null as null, authHeader };
  })
  .macro(({ onBeforeHandle }) => ({
    auth(opts: { permissions?: string[] } | true) {
      onBeforeHandle(({ user }) => {
        if (!user && opts !== true) {
          return new Response("Unauthorized", { status: 401 });
        }
      });
    },
  }));
