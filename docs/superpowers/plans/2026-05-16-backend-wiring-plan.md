# Backend Wiring — Implementation Plan

**Date:** 2026-05-16
**Spec:** `docs/superpowers/specs/2026-05-16-backend-wiring-design.md`
**Insight shape ref:** `docs/superpowers/specs/2026-05-16-insight-quality-design.md`
**Scope:** API + DB + shared. Workers untouched.

---

## Locked constraints

- Drizzle migrations only — no raw `ALTER TABLE`.
- pg-boss only — no Redis.
- No `authPlugin` on `/v1/reports` routes (MVP anonymous).
- Workers (`@rivaleye/worker`) are NOT modified by this plan.
- Keep legacy `status` column alongside the new `stage` column for worker back-compat (spec §1.5).
- `PainReportOutput` stays exported as a deprecated alias to the new `ReportOutput`.

---

## Phase summary

| Phase | Topic | Tasks | Parallel-safe? |
|---|---|---|---|
| 0 | Shared package — Zod schemas + types | 4 | Internally parallel (all in shared/) |
| 1 | DB schema edit (`reports.ts`) | 1 | Sequential — blocks Phase 2 |
| 2 | Drizzle migration generate + apply | 2 | Sequential |
| 3 | Service layer (`reports.service.ts`, delete `report-generator.ts`) | 2 | Internally parallel (different files) |
| 4 | Controller handlers (rewrite create, rewrite get, delete list) | 3 | Internally parallel (different files) |
| 5 | Routes wiring (`controllers/reports/index.ts`) | 1 | Sequential after Phase 4 |
| 6 | API CLAUDE.md TODO note | 1 | Parallel with any other phase ≥ 3 |
| 7 | Verification | 4 | Sequential after Phase 6 |

**Totals:** 8 phases · 18 tasks · phases 1→2→3→4→5 form the critical chain; phase 0 can begin immediately; phase 6 floats; phase 7 is terminal.

---

## Phase 0 — Shared package

Updates `@rivaleye/shared` to expose the new wire schemas. Workers and frontend already import from here.

### 0.1 Add `reportStageSchema`
- **File:** `packages/shared/src/schemas/report.ts`
- **Action:** Add `reportStageSchema = z.enum(["queued","scraping","clustering","done","failed"])`; export `ReportStage = z.infer<...>`.
- **Acceptance:** Schema exported; type appears in `index.ts` barrel re-export.
- **Parallel-safe:** YES (with 0.2, 0.3, 0.4 — same file but distinct additions; do as one edit pass).

### 0.2 Add PRD §10 `reportOutputSchema`
- **File:** `packages/shared/src/schemas/report.ts`
- **Action:** Add Zod schemas mirroring spec §1.4 — `sourceSchema`, `painClusterSchema`, `featureGapSchema`, `switchingSignalSchema`, `opportunitySchema`, then `reportOutputSchema` composing them. Use `z.array(...).length(3)` for `top_opportunities`. snake_case keys throughout.
- **Acceptance:** `reportOutputSchema.parse(samplePRDPayload)` succeeds in mental check; type `ReportOutput = z.infer<typeof reportOutputSchema>` exported.
- **Parallel-safe:** YES (with 0.1, 0.3).

### 0.3 Replace `createReportInputSchema`
- **File:** `packages/shared/src/schemas/report.ts`
- **Action:** Rewrite to `{ category, competitors (1-5), target_audience (required string), founder_goal (reportGoalSchema) }`. Drop `platforms`. Drop optional `audience`.
- **Acceptance:** Old `audience` and `platforms` keys are gone; `CreateReportInput` type matches spec §2.1.
- **Parallel-safe:** YES.

### 0.4 Retain `PainReportOutput` as alias + add legacy schema
- **File:** `packages/shared/src/types/index.ts` and `packages/shared/src/schemas/report.ts`
- **Action:** In `types/index.ts`, keep the existing `PainReportOutput` interface; add JSDoc `@deprecated — use ReportOutput`. In `schemas/report.ts`, add `legacyReportOutputSchema` matching the existing shape (per spec §3.2). Re-export both `reportOutputSchema` and `legacyReportOutputSchema` from `index.ts`.
- **Acceptance:** Imports from `@rivaleye/shared` still resolve `PainReportOutput`; new `ReportOutput` co-exists.
- **Parallel-safe:** YES.

---

## Phase 1 — DB schema edit

### 1.1 Edit `reports.ts` schema
- **File:** `packages/api/src/db/schema/reports.ts`
- **Action:**
  - Add `reportStageEnum = pgEnum("report_stage", ["queued","scraping","clustering","done","failed"])`.
  - Add column `stage: reportStageEnum("stage").notNull().default("queued")`.
  - Add column `error: text("error")` (nullable).
  - Widen `output` TS typing from `Record<string, unknown> | null` to `ReportOutput | LegacyReportOutput | null` (import types from `@rivaleye/shared`). Keep `jsonb` column type unchanged.
  - Keep `status`, `goal`, `audience`, `competitors`, `ownerId` exactly as today.
- **Acceptance:** File compiles; `Report` inferred type now includes `stage: ReportStage` and `error: string | null`; `status` is still present.
- **Parallel-safe:** NO — blocks Phase 2.

---

## Phase 2 — Migration

### 2.1 `pnpm db:generate`
- **Command:** `pnpm db:generate` from repo root.
- **Action:** Drizzle emits `packages/api/drizzle/0002_<name>.sql` (next ordinal after current `0001_young_slipstream.sql`).
- **Acceptance criteria:** Generated SQL contains exactly:
  - `CREATE TYPE "public"."report_stage" AS ENUM ('queued','scraping','clustering','done','failed');`
  - `ALTER TABLE "reports" ADD COLUMN "stage" "report_stage" DEFAULT 'queued' NOT NULL;`
  - `ALTER TABLE "reports" ADD COLUMN "error" text;`
  - No other statements (no DROPs, no rename of `status`).
- **On failure:** if Drizzle proposes anything else, revert and re-inspect schema diff. Do NOT hand-edit the SQL.
- **Parallel-safe:** NO — sequential after 1.1.

### 2.2 `pnpm db:migrate`
- **Command:** `pnpm db:migrate`.
- **Acceptance:** Migration applies cleanly; `drizzle.meta._journal.json` records the new migration; existing `reports` rows pick up `stage = 'queued'` via default.
- **Parallel-safe:** NO — sequential after 2.1.

---

## Phase 3 — Service layer

### 3.1 Create `reports.service.ts`
- **File:** `packages/api/src/services/reports.service.ts` (new)
- **Action:** Export two pure DB/queue functions:
  - `createReport(input: CreateReportInput): Promise<{ id: string }>` — inserts `{ category, competitors, audience: input.target_audience, goal: input.founder_goal, stage: "queued", status: "queued", ownerId: null }`; then `await enqueueScrapePlatform({ reportId, platform: "reddit", competitor: input.competitors[0], category: input.category })`; returns `{ id }`.
  - `getReport(id: string): Promise<Report | null>` — single-row select via Drizzle `eq(reports.id, id)`.
- **Acceptance:** No HTTP imports (no `Elysia`, no `status()`); no business logic that should belong in the worker; only DB writes + enqueue. Type-check clean.
- **Parallel-safe:** YES (with 3.2).

### 3.2 Delete `report-generator.ts`
- **File:** `packages/api/src/services/report-generator.ts`
- **Action:** Delete the file. The worker owns generation (root `CLAUDE.md` rule 10). All references in `create-report.ts` are removed in Phase 4.
- **Acceptance:** `grep -r "report-generator" packages/api/src` returns empty; `grep -r "runReport" packages/api/src` returns empty.
- **Parallel-safe:** YES (with 3.1) — but Phase 4.1 depends on this deletion not being reverted.

---

## Phase 4 — Controller handlers

### 4.1 Rewrite `create-report.ts`
- **File:** `packages/api/src/controllers/reports/handlers/create-report.ts`
- **Action:**
  - Drop `import { runReport }`; drop `import { db }`; drop `import { reports }`.
  - Import `createReport` from `@/services/reports.service`.
  - Replace handler body with: validate (Elysia `t.*`), call service, respond `{ id, stage: "queued" as const }`.
  - Body schema per spec §2.1: `t.Object({ category, competitors: t.Array(t.String(), {minItems:1, maxItems:5}), target_audience: t.String({minLength:1}), founder_goal: t.Union([6 literals]) })`.
  - Response shape via Elysia `response: t.Object({ id: t.String(), stage: t.Literal("queued") })`.
  - **Do NOT** apply `authPlugin`.
- **Acceptance:** Handler has no `db` import, no direct `runReport` call, only enqueues via the service. No `goal ?? "find_user_pain"` default — `founder_goal` is required.
- **Parallel-safe:** YES (with 4.2, 4.3).

### 4.2 Rewrite `get-report.ts`
- **File:** `packages/api/src/controllers/reports/handlers/get-report.ts`
- **Action:**
  - Drop direct `db`/`reports` imports.
  - Import `getReport` from `@/services/reports.service`.
  - Map DB row → DTO (spec §2.2): rename `audience` → `target_audience`, `goal` → `founder_goal`; pass through `stage`, `error`, `output`, `created_at`, `updated_at`, `id`, `category`, `competitors`.
  - 404 with `status(404, { message: "report not found" })` on null.
  - Add `response` schema. **Do NOT** apply `authPlugin`.
- **Acceptance:** Handler calls service; returns DTO not raw row; types pass.
- **Parallel-safe:** YES (with 4.1, 4.3).

### 4.3 Delete `list-reports.ts`
- **File:** `packages/api/src/controllers/reports/handlers/list-reports.ts`
- **Action:** Delete file (spec §2.3 — not in MVP, frontend uses localStorage).
- **Acceptance:** File gone; will be unmounted in Phase 5.
- **Parallel-safe:** YES (with 4.1, 4.2).

---

## Phase 5 — Routes wiring

### 5.1 Update `controllers/reports/index.ts`
- **File:** `packages/api/src/controllers/reports/index.ts`
- **Action:**
  - Remove `import { listReports }` and the `.use(listReports)` chain.
  - Keep `.use(createReport).use(getReport)` only.
  - Add top-of-file comment: `// MVP: anonymous report creation. authPlugin intentionally not applied. Re-introduce per packages/api/CLAUDE.md §12.9 when user accounts ship.`
  - Confirm prefix `/reports` + tags unchanged; mounted under `/v1` via `controllers/index.ts` (verify only; do not edit unless mount missing).
- **Acceptance:** `POST /v1/reports` and `GET /v1/reports/:id` are the only two mounted routes under this controller. App type-checks. No `authPlugin` chain anywhere in the reports tree.
- **Parallel-safe:** NO — sequential after Phase 4.

---

## Phase 6 — API CLAUDE.md TODO note

### 6.1 Add temporary-bypass note
- **File:** `packages/api/CLAUDE.md`
- **Action:** Append to the "Open questions / TODO" section a single line:
  - `- [ ] MVP exception: reports controller is unauthenticated (anonymous report creation). Rule §12.9 is suspended for /v1/reports only. Re-apply authPlugin when "save report to my account" ships.`
- **Acceptance:** Line present; nothing else in the doc is changed.
- **Parallel-safe:** YES — floats; can be done with any phase ≥ 3.

---

## Phase 7 — Verification

### 7.1 Type-check
- **Command:** `pnpm --filter @rivaleye/api type-check`
- **Acceptance:** Exit 0. No `any`, no missing-import errors, no stale `PainReportOutput` import issues.

### 7.2 Boot the API
- **Command:** `pnpm --filter @rivaleye/api dev`
- **Acceptance:** Boots on `:6090` without throwing; pg-boss `[queue]` log lines appear; Swagger lists exactly the two reports endpoints.

### 7.3 Happy path — `curl`
- **Command:**
  ```
  curl -s -X POST http://localhost:6090/v1/reports \
    -H "Content-Type: application/json" \
    -d '{"category":"crm","competitors":["pipedrive"],"target_audience":"smb sales teams","founder_goal":"find_user_pain"}'
  ```
- **Acceptance:** Returns `{ "id": "<uuid>", "stage": "queued" }` with HTTP 200/201. A row appears in `reports` with `stage='queued'`, `status='queued'`, `owner_id=NULL`, `audience='smb sales teams'`, `goal='find_user_pain'`.

### 7.4 Job enqueued + worker pickup
- **Action:** Inspect `pgboss.job` table or run `pnpm --filter @rivaleye/worker dev` and watch logs.
- **Acceptance:** A `scrape-platform` job exists with payload `{ reportId, platform: "reddit", competitor: "pipedrive", category: "crm" }`. Worker (untouched) picks it up; over time `stage` advances (worker still writes legacy `status`; new `stage` writes are a worker-side follow-up tracked separately per spec §1.5). For this plan, success = job exists AND worker processes it without crashing.
- Also `curl -s http://localhost:6090/v1/reports/<id>` returns the DTO with `target_audience`, `founder_goal`, `stage`, `error`, `output: null`.

---

## Self-review — contradictions checked against spec

- Spec §1.5 requires keeping `status` for worker back-compat → plan keeps `status` column untouched (Phase 1.1) and the service writes both `stage` and `status` on insert (Phase 3.1). Match.
- Spec §2.1 forbids `platforms` in request body → plan 4.1 drops it. Match.
- Spec §2.4 requires service split → plan 3.1 creates `reports.service.ts`, 4.1/4.2 stop calling `db` directly. Match.
- Spec §3.2 requires keeping `PainReportOutput` exported as a deprecated alias → plan 0.4 keeps it and adds `legacyReportOutputSchema`. Match.
- Spec §4 requires NOT applying `authPlugin` and NOT deleting it → plan never deletes `plugins/auth.ts`; only the reports controller skips it. Match.
- Spec §1.3 names reconciliation: keep `decide_mvp_features` / `find_user_pain` enum values → plan does not migrate the enum. Match.
- Spec §1.6 says single migration, schema edit + generated SQL in one commit → plan groups them in Phases 1+2. Match.
- Spec §2.3 says delete `list-reports.ts` → plan 4.3 deletes it; 5.1 unmounts. Match.
- Root `CLAUDE.md` rule 10 "Api enqueues, never scrapes" → plan deletes `report-generator.ts` (3.2) and removes `runReport` call (4.1). Match.
- Spec insight-quality §8 defines a different (more detailed) output shape than spec backend-wiring §1.4. The wiring spec is the source of truth for the API write surface (§1.4 of wiring spec) and the insight-quality shape is what the worker eventually emits. Plan follows wiring spec §1.4 for `reportOutputSchema`; widened jsonb typing accepts either via `ReportOutput | LegacyReportOutput | null`. Worker output evolution is out of scope.
- Insight-quality spec uses `decide_mvp` / `find_wedge` / `general` goal values that DO NOT match the DB enum. Wiring spec §1.3 explicitly says keep DB enum values; mapping/UI copy is the frontend's problem. Plan does not touch the enum. Documented divergence, not a contradiction in scope of this plan.

No contradictions remain inside the plan itself.
