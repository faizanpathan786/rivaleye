# RivalEye — Project Guide for Agents

Source of truth for repo layout, conventions, and hard rules. Read before non-trivial changes. Update when conventions change.

---

## 1. What this repo is

The RivalEye monorepo. RivalEye helps early-stage B2B SaaS founders find what users complain about in competing products, starting with Reddit pain reports.

**One-liner:** Find what your competitor's users hate before you build.

**MVP scope:** founder enters a competitor/category → backend pulls Reddit discussions → LLM clusters complaints → user gets a Competitor Pain Report (top pain points, feature gaps, pricing pain, switching signals, positioning angles, product opportunities).

See `docs/` for the full PRD (port from `archive/legacy-v1` if missing).

---

## 2. Stack

- **Package manager**: [pnpm](https://pnpm.io/) workspaces (>=9). Never use `npm` or `yarn`.
- **Monorepo runner**: [Turborepo](https://turbo.build/). Use `pnpm dev`, `pnpm build`, etc. — never run package commands from root without `turbo`/`pnpm --filter`.
- **Backend runtime**: [Bun](https://bun.sh/). Use `bun` for `apps/api` scripts.
- **Backend framework**: [Elysia](https://elysiajs.com/).
- **Database**: PostgreSQL on **Supabase** (managed Postgres only — no Supabase Auth, no supabase-js, no RLS magic).
- **Migrations**: [Drizzle ORM](https://orm.drizzle.team/) — **non-negotiable**. All schema lives in `packages/api/src/db/`. Never modify DB schema by hand.
- **Auth**: [better-auth](https://www.better-auth.com/) on the same Supabase Postgres. No Supabase Auth.
- **Frontend**: Vite + React + TypeScript + Tailwind + shadcn/ui (Radix primitives). No Next.js, no MUI, no Minimals template.
- **Background jobs**: **none** for MVP. Report generation runs inline in the request handler, streaming progress to the client. Add a job runner only when a real timeout problem appears.

---

## 3. Repo layout

```
rivaleye-v3/
  CLAUDE.md                  ← this file (monorepo-wide rules)
  package.json               ← root scripts (turbo wrappers)
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json         ← shared compiler options
  .env.example
  .gitignore
  docs/                      ← PRD, architecture notes (port from legacy as needed)
  packages/
    api/                     ← Bun + Elysia + Drizzle + better-auth
      CLAUDE.md              ← backend rules
      src/
      drizzle/               ← generated migrations
      drizzle.config.ts
      package.json
      tsconfig.json
    web/                     ← Vite + React + Tailwind + shadcn
      CLAUDE.md              ← frontend rules
      src/
      package.json
      tsconfig.json
      vite.config.ts
      tailwind.config.ts
    shared/                  ← shared types, zod schemas, constants used by api+web
      src/
      package.json
      tsconfig.json
    reddit-client/           ← Reddit fetch + normalize (consumed by api)
      src/
      package.json
      tsconfig.json
```

**Adding a package**: create folder under `packages/`, add `package.json` with name `@rivaleye/<name>`, mirror an existing package's `tsconfig.json` extending `../../tsconfig.base.json`. Add to relevant `turbo.json` task list if it has new task names.

---

## 4. Workspace dependency rules

- Internal packages reference each other via `"@rivaleye/<name>": "workspace:*"` in `dependencies`.
- Never duplicate a dependency across packages when one can live in `shared/` and be re-exported.
- Keep `devDependencies` (TS, eslint, prettier) at the **root** when shared. Only put a dev dep in a package when it's package-specific (e.g. `drizzle-kit` in `api/`, `vite` in `web/`).
- Never add a package-level lockfile. The repo has **one** `pnpm-lock.yaml` at the root.

---

## 5. Legacy code

The previous implementation is preserved on the `archive/legacy-v1` branch and **not merged back**. Treat it as read-only reference. When porting code from legacy:

1. Cherry-pick logic (Reddit normalization, LLM prompts, schema ideas) — never the file structure.
2. Every port must be a rewrite that matches current conventions in this CLAUDE.md.
3. Add a one-line PR description: "ported from archive/legacy-v1: <file>".
4. Never `git checkout archive/legacy-v1 -- <path>` to copy verbatim.

---

## 6. Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `CONNECTION_STRING` | api | Supabase Postgres connection string |
| `BETTER_AUTH_SECRET` | api | better-auth signing secret |
| `BETTER_AUTH_URL` | api | better-auth base URL (e.g. `http://localhost:6090`) |
| `REDDIT_CLIENT_ID` | reddit-client | Reddit app id |
| `REDDIT_CLIENT_SECRET` | reddit-client | Reddit app secret |
| `REDDIT_USER_AGENT` | reddit-client | Reddit API user-agent string |
| `ANTHROPIC_API_KEY` | api | Claude API key for clustering/insight LLM calls |
| `OPENAI_API_KEY` | api | Fallback / embedding model key |
| `VITE_API_URL` | web | Base URL of the api server |

Always read from `process.env` / `import.meta.env`. Never hardcode. Never commit `.env*` files. Keep `.env.example` synced when adding new vars.

---

## 7. Dev commands

```sh
pnpm install                          # install all workspace deps
pnpm dev                              # run all packages in dev (turbo)
pnpm --filter @rivaleye/api dev       # backend only
pnpm --filter @rivaleye/web dev       # frontend only
pnpm db:generate                      # drizzle migration from schema diff
pnpm db:migrate                       # apply pending migrations
pnpm db:studio                        # drizzle studio (DB browser)
pnpm build                            # build all packages
pnpm type-check                       # tsc --noEmit across workspace
pnpm lint                             # eslint across workspace
```

---

## 8. Coding conventions (repo-wide)

- **TypeScript strict mode**. Never disable strict checks. `noUncheckedIndexedAccess` is on.
- **Named exports** everywhere. No default exports except where a framework requires one (Vite entry, etc).
- **File naming**: kebab-case (`pain-report.ts`, `reddit-client.ts`).
- **No comments** unless the *why* is non-obvious. Good names explain the *what*.
- **Imports**: relative within a package (`./services/foo`); cross-package via `@rivaleye/<name>`.
- **Errors**: throw typed errors at boundaries; never swallow.
- **Validation**: validate at system boundaries (HTTP body, external API responses). Trust internal calls.
- **No `any`**. Use `unknown` + narrowing.

---

## 9. Hard rules for agents

1. **All DB schema changes go through Drizzle migrations.** No raw `ALTER TABLE` against any environment.
2. **Never touch `archive/legacy-v1`.** Port-by-rewrite, never copy.
3. **Never hardcode secrets, connection strings, or API keys.** Always env.
4. **Never put business logic in a route handler.** Controllers/routes call services. (See `packages/api/CLAUDE.md`.)
5. **Never put HTTP-level logic in a service.** Services return data; controllers shape responses.
6. **Elysia's type system is the API contract** — use `t.*` schemas on routes. Don't bypass with `any`.
7. **One lockfile.** No package-level `pnpm-lock.yaml`.
8. **No Supabase client.** Talk to Postgres via Drizzle only. Supabase is just managed Postgres for us.
9. **Permission-first** — before any new CRUD feature, define permission codes (e.g. `REPORTS_CREATE`, `REPORTS_VIEW`), seed them, and guard handlers with them. Never check role names in handlers.
10. **No background-job infra until proven necessary.** MVP runs report generation inline. If a real timeout problem appears, file an issue first, then add infra.

---

## 10. Open questions / TODO

- [ ] Decide on tRPC vs plain REST between `web` and `api`. Default: REST with Elysia's type-exported client until a concrete need pushes us to tRPC.
- [ ] Choose LLM provider as primary (Claude vs OpenAI). Wire both via a small `llm-client` abstraction in `shared/`.
- [ ] Pick a Reddit access strategy (OAuth app vs public JSON endpoints). Document rate-limit budget in `packages/reddit-client/CLAUDE.md`.
- [ ] Pricing/billing — Stripe integration is out of MVP; add when paid offer launches.
- [ ] Test runner — Bun ships with `bun test`. Adopt once the first non-trivial service lands.

Update this section as decisions land.
