import { Elysia } from "elysia";
import { auth } from "@/libs/auth";
import type { Permission } from "@/types/permissions";

export const authPlugin = new Elysia({ name: "auth" })
  .derive({ as: "scoped" }, async ({ request }) => {
    const result = await auth.api.getSession({ headers: request.headers });
    return {
      session: result?.session ?? null,
      user: result?.user ?? null,
    };
  })
  .macro({
    auth: (_config: { permissions?: Permission[] } = {}) => ({
      beforeHandle: async ({ session, user, status }) => {
        if (!session || !user)
          return status(401, { message: "Unauthorized", error: "UNAUTHORIZED" });
      },
    }),
  });

export const optionalAuthPlugin = new Elysia({ name: "optional-auth" })
  .derive({ as: "scoped" }, async ({ request }) => {
    try {
      const result = await auth.api.getSession({ headers: request.headers });
      return {
        session: result?.session ?? null,
        user: result?.user ?? null,
      };
    } catch {
      return { session: null, user: null };
    }
  });
