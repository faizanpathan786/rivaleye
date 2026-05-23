# Signal-Centric Pipeline — Phase 5 (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the live data wiring from the new `GET /v1/reports/:id/sections` API into the web app, and a clean read-only page that renders all six role sections from real data — proving the pipeline end-to-end.

**Scope note:** The other session has already built ~7,500 lines of pretty role-dashboard UI in `packages/web/src/routes/{founder,product,marketing,growth}.tsx` and the unified `scan-report.tsx`. Those pages are **hardcoded against custom mock shapes** that don't match doc 16. **Phase 5 MVP does NOT retrofit them** — that's a substantial per-page adapter task best owned by whoever designed them. Phase 5 MVP delivers: the API client/hook + one minimal live dashboard view that proves real data flows correctly from pipeline → DB → API → UI. Retrofitting the pretty pages is **Phase 5b**, deferred.

**Source spec:** `15-signal-centric-pipeline-redesign.md` §9 Phase 5; the data contract is the worker's `RoleSections` type (`packages/worker/src/prompts/role-sections/schema.ts`) which is doc 16.

---

## File Map

**Create:**
- `packages/web/src/api/report-sections.ts` — typed `getReportSections(id)` and shared `Sections` type
- `packages/web/src/hooks/queries/use-report-sections.ts` — `useReportSectionsQuery(id)` React Query hook
- `packages/web/src/routes/report-sections.tsx` — read-only live-data dashboard page

**Modify:**
- `packages/web/src/app.tsx` — add the new route

**Untouched:** existing `routes/founder.tsx`, `routes/product.tsx`, `routes/marketing.tsx`, `routes/growth.tsx`, `routes/scan-report.tsx`. The retrofit of these is Phase 5b.

---

## Task F1 — API client + React Query hook

**Files:** Create `packages/web/src/api/report-sections.ts`, `packages/web/src/hooks/queries/use-report-sections.ts`.

- [ ] **Step 1: read patterns.** Read `packages/web/src/api/reports.ts` for the axios + envelope (`unwrap`) pattern, and `packages/web/src/hooks/queries/use-reports.ts` for the React Query + `reportsKeys` pattern. Mirror them exactly.

- [ ] **Step 2: create `report-sections.ts`.** Define a `Sections` type as `{ overview: unknown | null; founder: unknown | null; product: unknown | null; marketing: unknown | null; growth: unknown | null; evidence: unknown | null }` (the API returns each as `unknown | null` — the renderer narrows them as needed). Export `async function getReportSections(reportId: string): Promise<Sections>` that calls `axios.get` against `${endpoints.reports}/${reportId}/sections` and `unwrap`s the response.

  If `endpoints.reports` does not exist or has a different name, find the analogous endpoint constant from `packages/web/src/lib/axios.ts` and use the matching pattern.

- [ ] **Step 3: create `use-report-sections.ts`.** Export `useReportSectionsQuery(id: string | undefined)` using `useQuery`. Query key: `["reports", "sections", id]`. `queryFn: () => getReportSections(id as string)`. `enabled: !!id`. No `refetchInterval` (sections only exist for completed reports).

- [ ] **Step 4:** `pnpm --filter @rivaleye/web type-check` — clean.

- [ ] **Step 5 (no commit).**

---

## Task F2 — Live sections dashboard page

**Files:** Create `packages/web/src/routes/report-sections.tsx`. Modify `packages/web/src/app.tsx`.

This page proves the pipeline end-to-end. It does NOT need to be visually polished — structured-clear is enough.

- [ ] **Step 1: create `report-sections.tsx`.** Read URL `:id` via `useParams`. Use `useReportSectionsQuery(id)`. Render:
  - **Loading:** a simple "Loading sections…" message (or `<Skeleton>` from `@/components/ui/skeleton`).
  - **Error:** a clear error message with the error text.
  - **Loaded:** a tab layout (use `@radix-ui/react-tabs` via `@/components/ui/tabs` if it exists — check `packages/web/src/components/ui/` for the available primitive; if `tabs.tsx` isn't there, use a simple vertical list with section headings instead). Six tabs: Overview, Founder, Product, Marketing, Growth, Evidence. Each tab's body renders that section's data with `<SectionRenderer data={sections.X} />`.

- [ ] **Step 2: `SectionRenderer`** — a single in-file component that takes `data: unknown | null` and renders it structurally:
  - If `data === null`: "Section not generated for this report."
  - If `data` has shallow scalar fields and arrays, render scalars as labelled lines and arrays as bullet lists or cards.
  - For now, a pragmatic fallback for any unrecognised shape: `<pre>{JSON.stringify(data, null, 2)}</pre>` inside a scrollable container with monospace styling.
  - This is intentionally simple — it proves data is real and complete without committing to per-widget UI (which is Phase 5b).

- [ ] **Step 3: register the route in `app.tsx`.** Import `ReportSectionsPage`. Add a protected route at `/reports/:id/sections` rendered with `<ReportSectionsPage />` inside the `AppShell` and `AuthGuard` (mirror how `ReportPage` at `/scan-report` or `/report/...` is wired).

- [ ] **Step 4:** `pnpm --filter @rivaleye/web type-check` — clean.

- [ ] **Step 5 (no commit).**

---

## Task F3 — Verification

- [ ] **Step 1:** repo-root `pnpm type-check` — clean across the workspace.
- [ ] **Step 2 (live, optional):** `pnpm dev`, navigate to `/reports/<a-completed-report-id>/sections` — confirm the page loads, the query fires `GET /v1/reports/<id>/sections`, and each tab renders its section JSON. Sections with no row return `null` and the page shows the "not generated" message.

---

## Acceptance criteria

- [ ] `getReportSections(id)` API client + `useReportSectionsQuery` hook exist and type-check.
- [ ] `/reports/:id/sections` route renders all six sections (or "not generated" per missing section) from real persisted data.
- [ ] No changes to the existing `founder.tsx`/`product.tsx`/`marketing.tsx`/`growth.tsx`/`scan-report.tsx` mock pages.
- [ ] tsc clean across workspace.

## Phase 5b (deferred — out of scope here)

Retrofit the existing pretty mock dashboards to consume real data via adapters: write `toFounderMock(doc16Founder)`, `toProductMock(doc16Product)`, etc., and replace `FOUNDER_DATA` / `PRODUCT_DATA` / `MARKETING_DATA` / `GROWTH_DATA` with the adapter output keyed off the live query. Estimated effort: substantial per role (each page is 1500–2000+ lines with deeply nested custom shapes). Best owned by whoever designed those pages.
