# RivalEye — Project Guide for Agents

Source of truth for repo layout, conventions, and hard rules. Read before non-trivial changes. Update when conventions change.

---

## 1. What this repo is

The RivalEye monorepo. RivalEye is the **user-perception layer of competitor research** — it helps SaaS teams understand what a competitor's users actually say in public, and turn that into product, positioning, and growth decisions.

**One-liner:** See what users really think about your competitors — what they love, what they hate, what they want next, and who may be ready to switch.

**MVP scope:** a user enters a competitor → workers pull public discussions from multiple platforms in parallel → LLM clusters them into four core signal types — **Love, Pain, Gap, Switch** — → user gets a Competitor Perception Report with quotes, source links, and recommended actions. The first goal is one genuinely useful report, not a big dashboard or every-platform monitoring.

> **Read `docs/product-goal.md` before any non-trivial product, scope, or roadmap decision.** It is the canonical product vision and north star. Note the framing is four signal types — older code/docs may use pain-only ("Competitor Pain Report") language.

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
- **Background jobs**: [pg-boss](https://github.com/timgit/pg-boss) on the same Supabase Postgres. No Redis. Two queues: `scrape-platform` (fan-out, one per platform×competitor) and `generate-report` (fan-in after all scrapes finish).
- **Scrapers**: per-platform implementations in `packages/scrapers/`. Hostile platforms (LinkedIn, G2, Capterra, Twitter, Gmaps) wrap 3rd-party providers (Apify, X API, Places API). DIY scrapers (Reddit, ProductHunt, AppStore, PlayStore) live fully in-repo.

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
    api/                     ← Bun + Elysia + Drizzle + better-auth. HTTP only; enqueues jobs.
      CLAUDE.md
      src/
      drizzle/               ← generated migrations
      drizzle.config.ts
    worker/                  ← Bun process. Consumes pg-boss queues. Runs scrapers + LLM.
      CLAUDE.md
      src/
    scrapers/                ← One Scraper interface, one impl per platform.
      CLAUDE.md
      src/
        reddit/ g2/ capterra/ twitter/ linkedin/ producthunt/ appstore/ playstore/ gmaps/
    web/                     ← Vite + React + Tailwind + shadcn.
      CLAUDE.md
      src/
    shared/                  ← Zod schemas, types, constants. Used by api+worker+web.
      src/
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
| `BETTER_AUTH_URL` | api | better-auth base URL (e.g. `http://localhost:3001`) |
| `REDDIT_CLIENT_ID` | worker (scrapers/reddit) | Reddit app id |
| `REDDIT_CLIENT_SECRET` | worker (scrapers/reddit) | Reddit app secret |
| `REDDIT_USER_AGENT` | worker (scrapers/reddit) | Reddit API user-agent |
| `PRODUCTHUNT_TOKEN` | worker (scrapers/producthunt) | Product Hunt GraphQL API token |
| `X_API_BEARER` | worker (scrapers/twitter) | X (Twitter) API bearer (Basic tier or higher) |
| `APIFY_TOKEN` | worker (scrapers/g2, capterra, linkedin, gmaps) | Apify API token for hostile platforms |
| `GOOGLE_PLACES_API_KEY` | worker (scrapers/gmaps) | Optional alternative to Apify for gmaps |
| `ANTHROPIC_API_KEY` | worker | Claude API key for clustering/insight LLM calls |
| `OPENAI_API_KEY` | worker | Fallback / embedding model key |
| `OPENROUTER_API_KEY` | api + worker (shared/llm) | OpenRouter API key for LLM calls |
| `OPENROUTER_MODEL` | api + worker (shared/llm) | OpenRouter model slug, defaults to `deepseek/deepseek-chat` |
| `TRUSTPILOT_API_KEY` | worker (scrapers/trustpilot) | Trustpilot API key |
| `VITE_API_URL` | web | Base URL of the api server |

Always read from `process.env` / `import.meta.env`. Never hardcode. Never commit `.env*` files. Keep `.env.example` synced when adding new vars.

---

## 7. Dev commands

```sh
pnpm install                          # install all workspace deps
pnpm dev                              # run all packages in dev (turbo)
pnpm --filter @rivaleye/api dev       # api only
pnpm --filter @rivaleye/worker dev    # worker only
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
10. **Api never runs scrapers or LLM calls.** Api validates input + enqueues to pg-boss + reads report status/output. All long work happens in `@rivaleye/worker`. If you're tempted to call a scraper from an api handler, stop — enqueue a job.
11. **`@rivaleye/scrapers` outputs `NormalizedPost` only.** No platform-specific fields leak past the scraper boundary. See `packages/scrapers/CLAUDE.md`.
12. **Hostile platforms = buy, never DIY.** LinkedIn, G2, Capterra, Gmaps reviews are routed through 3rd-party providers (Apify et al.) inside the scraper class. No headless-browser farms in this repo.

---

## 10. Open questions / TODO

- [ ] Decide on tRPC vs plain REST between `web` and `api`. Default: REST with Elysia's type-exported client until a concrete need pushes us to tRPC.
- [ ] Choose LLM provider as primary (Claude vs OpenAI). Wire both via a small `llm-client` abstraction in `shared/`.
- [ ] Pick a Reddit access strategy (OAuth app vs public JSON endpoints). Document rate-limit budget in `packages/reddit-client/CLAUDE.md`.
- [ ] Pricing/billing — Stripe integration is out of MVP; add when paid offer launches.
- [ ] Test runner — Bun ships with `bun test`. Adopt once the first non-trivial service lands.

Update this section as decisions land.
