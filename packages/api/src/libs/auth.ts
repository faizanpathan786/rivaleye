import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

const defaultTrustedOrigins = [
  "http://localhost:3001",
  "http://localhost:4004",
  "http://localhost:4005",
  "http://localhost:4006",
  "https://rivaleye.app",
  "http://rivaleye.app",
];
const envTrustedOrigins = (process.env.TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const authMountBase = `${process.env.BETTER_AUTH_URL ?? "http://localhost:4000"}/v1/auth`;
const callbackURI = (provider: string) => `${authMountBase}/callback/${provider}`;

const PLACEHOLDER_SECRETS = new Set(["change-me-in-prod", "your-secret-key-here"]);
const authSecret = process.env.BETTER_AUTH_SECRET;
if (!authSecret || PLACEHOLDER_SECRETS.has(authSecret) || authSecret.length < 32) {
  throw new Error(
    "BETTER_AUTH_SECRET must be set to a strong value (>=32 chars, not a placeholder). Generate one with `openssl rand -hex 32`.",
  );
}

export const auth = betterAuth({
  secret: authSecret,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:4000",
  basePath: "/",
  trustedOrigins: [...defaultTrustedOrigins, ...envTrustedOrigins],
  advanced: {
    database: {
      generateId: () => randomUUID(),
    },
  },
  emailAndPassword: {
    enabled: true,
    // Gated behind an env flag: default OFF so the pre-launch demo/signup
    // flow keeps working without an email provider wired up. Flip
    // REQUIRE_EMAIL_VERIFICATION=true once transactional email is in place.
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === "true",
  },
  // Scripted signups are the cheap abuse vector here: each account gets a
  // free scan, and a scan is a real scrape + LLM cost. Rate limit sign-up
  // stricter than general auth traffic.
  //
  // NOTE on storage: better-auth's "database" rate-limit storage requires a
  // `rateLimit` table registered in the drizzleAdapter `schema` map above.
  // That table doesn't exist yet in packages/api/src/db/schema and adding it
  // requires a Drizzle migration — out of scope for this change (schema/
  // migrations are owned separately and this task is explicitly barred from
  // touching db/**). Using "memory" for now: still stops single-process
  // scripted abuse, just doesn't survive a process restart. Once a
  // `rate_limit` Drizzle table + migration lands, flip `storage: "database"`.
  //
  // Note: this only bounds signup/signin abuse. A separate, coarser
  // per-IP scan-enqueue budget is enforced in the reports pipeline
  // (see @rivaleye/api reports.service.ts / worker fan-out), independent of
  // this account-creation limiter.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
    storage: "memory",
    customRules: {
      "/sign-up/email": { window: 60 * 10, max: 5 },
      "/sign-in/email": { window: 60, max: 10 },
    },
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            redirectURI: callbackURI("google"),
          },
        }
      : {}),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            redirectURI: callbackURI("github"),
          },
        }
      : {}),
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema: {
      users: schema.users,
      sessions: schema.sessions,
      accounts: schema.accounts,
      verifications: schema.verifications,
    },
  }),
  user: {
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  session: {
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
      requireLocalEmailVerified: false,
    },
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      idToken: "id_token",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
});

export type Auth = typeof auth;
