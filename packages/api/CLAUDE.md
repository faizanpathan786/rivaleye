# @rivaleye/api — Backend Guide for Agents

The RivalEye HTTP API. Lives at `packages/api/`. Serves `@rivaleye/web`. Any change to a request/response shape, auth token format, or DB schema must be coordinated with the consumers.

Read the root `CLAUDE.md` first. This file extends it with backend-specific rules.

---

## 1. Stack

- **Runtime**: [Bun](https://bun.sh/) — use `bun`, never `node`/`npm`.
- **Framework**: [Elysia](https://elysiajs.com/) — typed, Bun-native HTTP framework.
- **Database**: Supabase Postgres (managed). Talk to it via Drizzle. No supabase-js, no RLS.
- **Migrations**: [Drizzle ORM](https://orm.drizzle.team/) — non-negotiable.
- **Auth**: [better-auth](https://www.better-auth.com/) on the same Postgres.
- **JWT middleware** (when needed): `@elysiajs/jwt`.
- **Logging**: pino via `@bogeychan/elysia-logger`.
- **API docs**: Swagger via `@elysiajs/swagger` — auto-generated from Elysia route types.
- **Dev port**: `6090`.

---

## 2. Folder structure

```
packages/api/
  src/
    server.ts          ← Entry point. Mounts plugins then controllers. Keep it thin.
    config/            ← Elysia plugin configs (cors, swagger, logger). One file per concern.
    controllers/       ← Route handlers grouped by domain. One subfolder per domain.
    services/          ← Business logic. Controllers call services; services call db/libs.
    db/
      client.ts        ← Drizzle client.
      schema/          ← Drizzle schema files (one per logical group).
    middlewares/       ← Elysia middleware.
    plugins/           ← Reusable Elysia plugins (auth, etc.).
    helpers/           ← Pure utility functions.
    libs/              ← External service clients (LLM, etc.).
    types/             ← Shared TS types + permission codes.
  drizzle/             ← Generated migration files (do not edit by hand).
  drizzle.config.ts
  package.json
  tsconfig.json
```

---

## 3. Controller conventions

Controllers live in `src/controllers/<domain>/`. Each domain follows this pattern:

```
src/controllers/reports/
  index.ts                ← Creates the Elysia sub-app with prefix, mounts handlers
  handlers/
    list-reports.ts       ← One file per route handler
    create-report.ts
    get-report.ts
```

```ts
// index.ts
import { Elysia } from "elysia";
import { listReports } from "./handlers/list-reports";
import { createReport } from "./handlers/create-report";

export const reportsController = new Elysia({
  prefix: "/reports",
  tags: ["reports"],
})
  .use(listReports)
  .use(createReport);
```

All controllers are mounted in `src/controllers/index.ts` under `/v1`:

```ts
export const controllers = new Elysia({ prefix: "/v1" })
  .use(reportsController)
  .use(competitorsController);
```

**Adding a new domain**: create a new subfolder, add its `index.ts`, mount it in `controllers/index.ts`. Never inline route logic in `server.ts`.

---

## 4. Domain routing — canonical map

Each route belongs to exactly one domain controller. Be generous — when in doubt, give a concept its own domain rather than stuffing into a catch-all.

| Domain prefix | Controller folder | Owns |
|---|---|---|
| `/authentication` | `authentication/` | sign-in, logout, session info |
| `/authorization` | `authorization/` | `userPermissions` — what the current user can do. Nothing else. |
| `/users` | `users/` | user records |
| `/competitors` | `competitors/` | CRUD for saved competitors |
| `/reports` | `reports/` | create, list, get, export pain reports |
| `/insights` | `insights/` | (future) cluster/gap/opportunity sub-resources of a report |
| `/sources` | `sources/` | (future) ingestion source records (Reddit threads, etc.) |
| `/billing` | `billing/` | (future) plan, invoices, Stripe webhooks |

**Rules:**
- `authorization/` is NOT a dumping ground for anything auth-adjacent. Owns only the "what can I do?" concern.
- When adding a handler, ask: "what noun does this operate on?" — that noun is the domain. If the noun has no controller yet, create one.
- Never grow a single controller into a catch-all.

---

## 5. Service layer conventions

Controllers are thin — they validate input via Elysia's `t.*` schema and call a service. Services own business logic and DB access.

```
controller handler → service function → db query / external lib
```

- Never put DB queries directly in a route handler.
- Never put HTTP-level logic (status codes, response shaping) in a service.

---

## 6. Database & Drizzle — non-negotiable

- Schema files live in `src/db/schema/`. Define tables using Drizzle's schema DSL.
- Re-export everything from `src/db/schema/index.ts`.
- Generate migrations: `pnpm db:generate` (root) — produces SQL in `drizzle/`.
- Apply migrations: `pnpm db:migrate`.
- **Never edit generated migration files by hand.**
- **Never run raw `ALTER TABLE` / `CREATE TABLE` against the DB.**
- Schema change + migration must be in the same commit as the service/controller code that uses it.

---

## 7. Auth

Two layers:

1. **better-auth** — primary auth library. Configured in `src/libs/auth.ts` with the Drizzle adapter. Mounted at `/v1/auth/*` for future built-in routes (email link, OAuth, password reset).
2. **`@elysiajs/jwt`** — used when we need to sign tokens for external systems (e.g., a Reddit-side webhook). Stored on the session if it grows beyond a single use.

Public signup may be allowed for the MVP (founder enters email, gets a report). When that flips, an admin invite endpoint goes under `/v1/admin/users` guarded by `USERS_INVITE`.

`web` reads session via better-auth's client. Never change the JWT/session payload shape without updating `web/src/lib/auth.ts`.

---

## 8. API contract & types

- **Elysia's type system is the API contract.** Define input/output via `t.*` schemas on every route. Swagger and the frontend type client derive from these.
- Don't write parallel Zod schemas for the same shape. If `shared/` needs a schema for cross-package validation (e.g. report config), put it in `shared/` and import on both sides.
- Never bypass with `any` / `unknown` returns from a handler.

---

## 9. Environment variables

| Variable | Purpose |
|---|---|
| `CONNECTION_STRING` | Supabase Postgres URL |
| `BETTER_AUTH_SECRET` | better-auth signing secret |
| `BETTER_AUTH_URL` | better-auth base URL (`http://localhost:6090` in dev) |
| `ANTHROPIC_API_KEY` | Claude API key for LLM analysis |
| `OPENAI_API_KEY` | Fallback / embedding model |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` / `REDDIT_USER_AGENT` | Reddit API access (consumed via `@rivaleye/reddit-client`) |

Always read from `process.env`. Never hardcode. Never commit `.env*`.

---

## 10. Coding conventions

- TS strict mode. No `any`.
- Named exports. No default exports unless framework requires.
- File naming: kebab-case (`list-reports.ts`).
- Error handling via Elysia's built-in error system (`error()` responses). Don't throw raw errors from handlers.
- Comments only when the *why* is non-obvious. Good names explain the *what*.
- Imports within a package: relative (`./services/foo`). Cross-package: `@rivaleye/<name>`.

---

## 11. Dev commands

Run from the repo root (recommended) or with `pnpm --filter @rivaleye/api`:

```sh
pnpm --filter @rivaleye/api dev          # bun --watch src/server.ts on :6090
pnpm db:generate                         # drizzle migration from schema diff
pnpm db:migrate                          # apply pending migrations
pnpm db:studio                           # Drizzle Studio
pnpm --filter @rivaleye/api type-check
```

---

## 12. Hard rules for agents

1. **All DB schema changes go through Drizzle migrations.** No exceptions.
2. **Domain routing is strict** (§4). Each handler lives in the controller whose prefix matches its noun. Never grow `authorization/` or any future `admin/` as a catch-all.
3. **Never hardcode secrets, connection strings, or API keys** — always env.
4. **Never put business logic in a route handler** — handlers call services.
5. **Never put HTTP logic in a service** — services return data; controllers shape responses.
6. **Elysia's type system defines the API contract** — use `t.*` schemas. No `any`.
7. **Always run `pnpm db:generate` after changing schema** — commit the generated migration in the same commit as the schema change.
8. **Permission-first** — before any new CRUD feature, define permission codes in `src/types/permissions.ts`, seed the DB rows, and guard handlers with them. Never check role names.
9. **Every endpoint MUST be protected** — every route handler (except `sign-in`) MUST use `authPlugin` and declare `auth: { ... }` in the route options:

    ```ts
    import { authPlugin } from "@/plugins/auth";
    import { PERMISSIONS } from "@/types/permissions";

    export const listReports = new Elysia()
      .use(authPlugin)
      .get("/", async ({ user }) => { /* ... */ }, {
        auth: { permissions: [PERMISSIONS.REPORTS_VIEW] },
      });
    ```

    `auth: {}` permits any authenticated user. Permissions array is OR-semantics.

    Audit: `grep -L "auth:" src/controllers/*/handlers/*.ts` should return only `sign-in.ts`.

10. **Api enqueues, never scrapes.** Long work (Reddit fetch, LLM clustering) runs in `@rivaleye/worker` via pg-boss. Handlers may only enqueue + read DB. If you find yourself importing `@rivaleye/scrapers` into a handler or service in this package, stop — it belongs in worker.
11. **No raw SQL in handlers.** If Drizzle can't express it, write a service function with a clearly named query helper.

---

## 13. Open questions / TODO

- [ ] Wire better-auth Drizzle adapter once `users` table contract is final.
- [ ] Flesh out `services/report-generator.ts` — currently enqueues `scrape-platform` jobs fan-out; add `report_platform_jobs` row inserts so worker can fan-in.
- [ ] Decide on shared error type / response envelope. Default for now: `{ data, error }`.
- [ ] Add `bun test` for the first non-trivial service.
- [ ] Stripe billing endpoints under `/v1/billing` when the paid offer goes live.

Update this section as decisions land.
