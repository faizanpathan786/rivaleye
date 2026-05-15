import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db, users } from "@rivaleye/db";
import { signupSchema, loginSchema } from "@rivaleye/shared";
import { createUser, verifyCredentials, getUserWorkspace } from "../services/auth.service.js";
import { requireAuth } from "../plugins/auth.js";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "7d";

export async function authRoutes(app: FastifyInstance) {
  app.post("/signup", async (request, reply) => {
    const body = signupSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ success: false, error: "Invalid input", code: "VALIDATION_ERROR" });
    }

    try {
      const { user, workspace } = await createUser(body.data.email, body.data.password, body.data.name);
      const payload = { userId: user.id, workspaceId: workspace.id, email: user.email };

      const accessToken = app.jwt.sign(payload, { expiresIn: ACCESS_TOKEN_TTL });
      const refreshToken = app.jwt.sign(payload, { expiresIn: REFRESH_TOKEN_TTL });

      reply
        .setCookie("access_token", accessToken, { httpOnly: true, sameSite: "lax", path: "/" })
        .setCookie("refresh_token", refreshToken, { httpOnly: true, sameSite: "lax", path: "/api/auth/refresh" });

      return reply.status(201).send({
        success: true,
        data: { user: { id: user.id, email: user.email, name: user.name }, workspace },
      });
    } catch (err) {
      if (err instanceof Error && err.message === "EMAIL_TAKEN") {
        return reply.status(409).send({ success: false, error: "Email already in use", code: "EMAIL_TAKEN" });
      }
      throw err;
    }
  });

  app.post("/login", async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ success: false, error: "Invalid input", code: "VALIDATION_ERROR" });
    }

    try {
      const user = await verifyCredentials(body.data.email, body.data.password);
      const workspace = await getUserWorkspace(user.id);
      if (!workspace) throw new Error("No workspace found");

      const payload = { userId: user.id, workspaceId: workspace.id, email: user.email };
      const accessToken = app.jwt.sign(payload, { expiresIn: ACCESS_TOKEN_TTL });
      const refreshToken = app.jwt.sign(payload, { expiresIn: REFRESH_TOKEN_TTL });

      reply
        .setCookie("access_token", accessToken, { httpOnly: true, sameSite: "lax", path: "/" })
        .setCookie("refresh_token", refreshToken, { httpOnly: true, sameSite: "lax", path: "/api/auth/refresh" });

      return reply.send({
        success: true,
        data: { user: { id: user.id, email: user.email, name: user.name }, workspace },
      });
    } catch {
      return reply.status(401).send({ success: false, error: "Invalid credentials", code: "INVALID_CREDENTIALS" });
    }
  });

  app.post("/logout", { preHandler: [requireAuth] }, async (_request, reply) => {
    reply
      .clearCookie("access_token", { path: "/" })
      .clearCookie("refresh_token", { path: "/api/auth/refresh" });

    return reply.send({ success: true, data: null });
  });

  app.get("/me", { preHandler: [requireAuth] }, async (request, reply) => {
    const [dbUser] = await db
      .select({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, request.user.userId))
      .limit(1);

    const workspace = await getUserWorkspace(request.user.userId);

    return reply.send({
      success: true,
      data: {
        user: dbUser ?? request.user,
        workspace,
      },
    });
  });
}
