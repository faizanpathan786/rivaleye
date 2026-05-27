# RivalEye v3 — Frontend MVP Implementation Plan

**Date:** 2026-05-16
**Spec:** `docs/superpowers/specs/2026-05-16-frontend-mvp-design.md`
**Backend contract:** `docs/superpowers/specs/2026-05-16-backend-wiring-design.md`
**Scope:** `packages/web/` only. No backend changes. No worker changes.

---

## Pre-flight notes

- Stack is locked: Vite + React + TS + Tailwind + shadcn/ui. No Next, no MUI.
- `App.tsx`, `QueryClientProvider`, react-router are already wired.
- `PainClusterCard` already exists at `packages/web/src/components/pain-cluster-card.tsx` (note: spec wants it relocated under `components/report/`, plan moves it).
- `useReport`/`useReports` already exist in `hooks/queries/use-report.ts` with correct 3000ms polling. Reuse, do not rewrite.
- API client at `lib/api.ts` already has the right surface — only minor type tightening needed.
- This plan assumes the **legacy** `PainReportOutput` shape (snake_case `top_opportunities` etc. is the **future** worker shape). MVP UI reads the **existing** `PainReportOutput` (camelCase, `painClusters`, `featureGaps`, etc.) since the worker has not been updated. Per spec §1.4 the backend wiring spec accepts both via `legacyReportOutputSchema`. Treat the current shape as the source of truth for sections; AnswerHero falls back gracefully where the new fields are absent.
- `[parallel-safe]` = task edits files no other parallel task touches in the same phase. Sequential tasks within a phase share files.

---

## Phase 0 — Dependencies and shadcn primitives

Goal: install missing runtime deps and generate the shadcn components used by later phases. No code changes outside `package.json`, `components.json`, and `components/ui/`.

### Task 0.1 — Add runtime deps to web package [sequential]
- **File(s):** `packages/web/package.json`, root `pnpm-lock.yaml`
- **Action:** Add the following to `dependencies`:
  - `@radix-ui/react-slot` (transitive via shadcn but pin explicitly)
  - `sonner` (toast)
  - `@radix-ui/react-accordion`
  - `@radix-ui/react-alert-dialog`
  - `@radix-ui/react-label`
  - `@radix-ui/react-select`
  - `@radix-ui/react-dialog`
  - `geist` (Geist Sans + Mono via npm package, exposes CSS for Vite import)
  - confirm `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` already present (they are).
- **Command:** `pnpm --filter @rivaleye/web add @radix-ui/react-slot @radix-ui/react-accordion @radix-ui/react-alert-dialog @radix-ui/react-label @radix-ui/react-select @radix-ui/react-dialog sonner geist`
- **Acceptance:** `pnpm install` clean; `package.json` lists every dep above; lockfile updated; `pnpm --filter @rivaleye/web type-check` still passes (no usage yet).

### Task 0.2 — Generate shadcn primitives [sequential, after 0.1]
- **File(s):** `packages/web/src/components/ui/*` (new), `packages/web/components.json`
- **Action:** Run from repo root:
  ```
  pnpm --filter @rivaleye/web dlx shadcn@latest add button input label select form alert alert-dialog card skeleton accordion table sonner badge
  ```
- **Acceptance:** Each component file exists in `packages/web/src/components/ui/`; no TS errors when `pnpm --filter @rivaleye/web type-check` runs; `components.json` unchanged or updated by CLI.

### Phase 0 verification
- `pnpm --filter @rivaleye/web type-check` passes.
- `pnpm --filter @rivaleye/web build` succeeds (no consumers of new components yet, so build is a smoke test of installation).

---

## Phase 1 — Tailwind config, Cold Steel tokens, global styles, fonts

Goal: replace generic shadcn defaults with the Cold Steel palette from spec §7 and load Geist fonts.

### Task 1.1 — Cold Steel CSS variables [parallel-safe within phase 1]
- **File:** `packages/web/src/styles/globals.css`
- **Action:** Replace the existing `:root` and `.dark` blocks with the dark-default Cold Steel palette (spec §7.1). Specifically:
  - Set `:root` to the **dark** values from spec §7.1 (because dark is default).
  - Add a `.light` selector with the light variant (kept for future toggle; not used in MVP).
  - Keep `@tailwind base/components/utilities` directives unchanged.
  - Keep the `@layer base { * { @apply border-border; } body { @apply bg-background text-foreground font-sans; } }` block; add `font-sans` on `body`.
  - Add `html { color-scheme: dark; }` so native UI matches.
- **Acceptance:** Tokens match spec §7.1 exactly (HSL values). `grep -E "#[0-9a-fA-F]{3,6}|rgb\(" packages/web/src/styles/globals.css` returns 0 hits.

### Task 1.2 — Tailwind config: font families + radius [parallel-safe]
- **File:** `packages/web/tailwind.config.ts`
- **Action:** Extend `theme.extend.fontFamily`:
  ```
  sans: ["Geist Sans", "Inter", "ui-sans-serif", "system-ui"]
  mono: ["Geist Mono", "JetBrains Mono", "ui-monospace", "SFMono-Regular"]
  ```
  Keep existing `colors` and `borderRadius` blocks. Confirm `darkMode: ["class"]`.
- **Acceptance:** Config compiles; `font-mono` and `font-sans` Tailwind utilities resolve to the new stacks.

### Task 1.3 — Load Geist fonts and toast root [sequential — edits `main.tsx` and `index.html`]
- **Files:** `packages/web/index.html`, `packages/web/src/main.tsx`
- **Action:**
  - In `main.tsx` add side-effect imports at top: `import "geist/font/sans";` and `import "geist/font/mono";` (the `geist` npm package exposes CSS).
  - In `index.html`, ensure `<html class="dark" lang="en">` is set on the root tag.
  - Mount `<Toaster />` from `sonner` inside `<App />` (handled in `app.tsx` in Phase 5; here only verify it does not exist twice).
- **Acceptance:** `document.documentElement.classList.contains('dark')` is true on load; Geist fonts render (Network tab shows woff files).

### Phase 1 verification
- `pnpm --filter @rivaleye/web dev` runs; visiting `/` shows the existing Home page with new dark Cold Steel background and Geist font (will be replaced in Phase 6, but tokens visible now).
- `pnpm --filter @rivaleye/web type-check` passes.

---

## Phase 2 — Shared types: align with current worker output

Goal: make sure `@rivaleye/shared` exports every type the frontend consumes. We do **not** migrate to the new snake_case `ReportOutput` here (that is the backend-wiring spec's follow-up). We only ensure `ReportGoal`, `PainReportOutput`, and a `ReportStage`-style discriminator exist for the UI.

### Task 2.1 — Confirm `ReportGoal` export and add display-label map [parallel-safe]
- **File:** `packages/web/src/lib/goal-labels.ts` (new)
- **Action:** Export `GOAL_LABELS: Record<ReportGoal, string>` from spec §4.1 (the 6 labels and their order). Export `GOAL_OPTIONS: { value: ReportGoal; label: string }[]` in spec order. No edits to `@rivaleye/shared` required (`reportGoalSchema` already lists the 6 values).
- **Acceptance:** Import `import { GOAL_OPTIONS, GOAL_LABELS } from "@/lib/goal-labels"` resolves; values match spec §4.1 order.

### Task 2.2 — Tighten `lib/api.ts` types [parallel-safe]
- **File:** `packages/web/src/lib/api.ts`
- **Action:**
  - Narrow `ReportRow.goal` from `string` to `ReportGoal` (import from `@rivaleye/shared`).
  - Narrow `create()` return to `{ id: string; status: ReportStatus }`.
  - `audience` stays `string | null` (DB is nullable).
  - Drop `platforms` field from request body if present (api spec removes it). For MVP, the current API still accepts `platforms` so leaving it in is harmless — keep it as `["reddit"]` for now and add a TODO comment to remove once backend-wiring lands.
- **Acceptance:** No `any` introduced. `tsc --noEmit` passes.

### Task 2.3 — Document legacy vs new output shape [parallel-safe]
- **File:** `packages/web/src/lib/report-output.ts` (new)
- **Action:** Export a small type alias `type ReportOutput = PainReportOutput` plus a helper `pickAnswerHeroData(output): { topOpportunities: string[]; positioningAngle: string | null; wedge: string | null }` that derives the AnswerHero inputs from the current `PainReportOutput`:
  - `topOpportunities = output.productOpportunities.slice(0, 3)`
  - `positioningAngle = output.positioningAngles[0] ?? null`
  - `wedge = output.competitorWeaknesses[0] ?? output.painClusters[0]?.title ?? null`
- **Acceptance:** Pure function; unit-testable; returns nulls when arrays empty.

### Phase 2 verification
- `pnpm --filter @rivaleye/web type-check` passes.

---

## Phase 3 — TanStack Query hooks

Goal: add the mutation hook for report creation. `useReport`/`useReports` already exist.

### Task 3.1 — `useCreateReport` mutation [sequential — single new file]
- **File:** `packages/web/src/hooks/queries/use-create-report.ts` (new)
- **Action:** Export `useCreateReport()` returning a `useMutation` that calls `api.reports.create`. On success, invoke a callback supplied by the caller (do not navigate inside the hook — keep it pure). Surface `mutateAsync` for the form. Use proper input/output types from `lib/api.ts` and `@rivaleye/shared`.
- **Acceptance:** Hook returns `{ mutate, mutateAsync, isPending, error }`. Type-check passes.

### Phase 3 verification
- `pnpm --filter @rivaleye/web type-check` passes.

---

## Phase 4 — LocalStorage history adapter

Goal: single helper module owning all `localStorage` access for history.

### Task 4.1 — `local-history.ts` [sequential — single new file]
- **File:** `packages/web/src/lib/local-history.ts` (new)
- **Action:** Implement per spec §6:
  - Const `STORAGE_KEY = "rivaleye.history.v1"`.
  - Type `LocalHistoryEntry = { id: string; competitor: string; goal: ReportGoal; createdAt: string }`.
  - Type `LocalHistory = { version: 1; reports: LocalHistoryEntry[] }`.
  - Exports: `getHistory(): LocalHistory`, `addReport(entry): void`, `removeReport(id): void`, `clearHistory(): void`.
  - Wrap every `localStorage` read/write in `try/catch` so the module degrades cleanly when storage is disabled (returns `{ version: 1, reports: [] }`).
  - Cap to 50 entries: on `addReport`, push then drop oldest by `createdAt` until length ≤ 50.
  - Migration safety: if parsed `version !== 1`, reset to empty.
- **Acceptance:** Functions return correct shape with localStorage disabled (override `window.localStorage` with throwing stub in mental test). 50-entry cap enforced. No other file in repo references `localStorage` directly (verify via grep before Phase done).

### Phase 4 verification
- `grep -r "localStorage" packages/web/src --exclude=lib/local-history.ts` returns 0 hits.
- `pnpm --filter @rivaleye/web type-check` passes.

---

## Phase 5 — Routing: `/history`, NotFound, Toaster mount

Goal: extend the router with the two missing routes and mount sonner Toaster.

### Task 5.1 — Add `/history` and `*` routes + mount Toaster [sequential — edits `app.tsx`]
- **File:** `packages/web/src/app.tsx`
- **Action:**
  - Import `HistoryPage` from `./routes/history` (will be created in Phase 8 — accept stub import for now).
  - Import `NotFoundPage` from `./routes/not-found` (created later).
  - Add routes: `{ path: "/history", Component: HistoryPage }` and `{ path: "*", Component: NotFoundPage }`.
  - Wrap `<RouterProvider />` and `<Toaster />` (from `sonner`) inside `<QueryClientProvider>`. Toaster props: `theme="dark"`, `richColors`, `position="bottom-right"`.
- **Acceptance:** Router compiles. The two route files referenced exist (stubs OK; replaced in later phases).

### Task 5.2 — Stub `not-found.tsx` [parallel-safe with 5.3 — different file]
- **File:** `packages/web/src/routes/not-found.tsx` (new)
- **Action:** Export `NotFoundPage()` rendering: `SiteHeader` + centered card with "Page not found" + shadcn `<Button asChild><Link to="/">Start a new report</Link></Button>`.
- **Acceptance:** Visiting `/garbage` renders the page; `Link` returns to `/`.

### Task 5.3 — Stub `history.tsx` (real implementation in Phase 8) [parallel-safe with 5.2]
- **File:** `packages/web/src/routes/history.tsx` (new)
- **Action:** Export `HistoryPage()` returning a placeholder `<main>` with "History (coming up)". This is a temporary stub so Phase 5 router edit type-checks. Phase 8 replaces the file.
- **Acceptance:** Type-checks. Route reachable at `/history`.

### Phase 5 verification
- `pnpm --filter @rivaleye/web type-check` passes.
- Manual: `/`, `/history`, `/reports/<anything>`, `/garbage` all render without crashing.

---

## Phase 6 — Home page rewrite + SiteHeader

Goal: replace `routes/home.tsx` with the spec §4.1 component tree using shadcn primitives and the new mutation hook.

### Task 6.1 — `SiteHeader` component [parallel-safe within phase 6]
- **File:** `packages/web/src/components/site/site-header.tsx` (new)
- **Action:** Sticky transparent header. Left: text logo `RivalEye` (`font-mono text-sm tracking-tight`). Right: `<Link to="/history">Recent reports</Link>` styled as `text-muted-foreground hover:text-foreground text-sm`.
- **Acceptance:** Used by Home, Report, History, NotFound. No props required.

### Task 6.2 — `Hero` component [parallel-safe]
- **File:** `packages/web/src/components/site/hero.tsx` (new)
- **Action:** Presentational. H1 "Find what your competitor's users hate." (`text-4xl md:text-5xl font-semibold tracking-tight`). Sub "Paste a competitor. Get a Reddit pain report in ~2 minutes. No signup." (`text-muted-foreground`).
- **Acceptance:** Renders inside the `max-w-2xl` container.

### Task 6.3 — `competitor-form.schema.ts` [parallel-safe]
- **File:** `packages/web/src/components/report/competitor-form.schema.ts` (new)
- **Action:** Export the zod schema from spec §4.1: `{ competitor, category, audience?, goal }`. Reuse `reportGoalSchema` from `@rivaleye/shared` for the `goal` field via `reportGoalSchema`. Export `CompetitorFormValues = z.infer<...>`.
- **Acceptance:** Schema matches spec exactly; default `goal` is `"find_user_pain"` (set in form, not schema).

### Task 6.4 — `CompetitorForm` component [sequential after 6.3]
- **File:** `packages/web/src/components/report/competitor-form.tsx` (new)
- **Action:** Implement per spec §4.1:
  - `react-hook-form` with `zodResolver(schema)`. Default `goal: "find_user_pain"`.
  - shadcn `<Form>` wrapper with `FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage`.
  - Inputs: competitor (`<Input>`), category (`<Input>` free-text — spec drops the hardcoded category list), audience (`<Input>`) inside a `<details>`/disclosure labeled "Optional details", goal (`<Select>` with `GOAL_OPTIONS` labels).
  - Submit button: shadcn `<Button>`. While `isPending`: `<Loader2 className="animate-spin" />` + "Generating…", inputs disabled.
  - On error from mutation: shadcn `<Alert variant="destructive">` above the button.
  - On success: call `addReport({ id, competitor: values.competitor, goal: values.goal, createdAt: new Date().toISOString() })` then `navigate("/reports/" + id)`.
  - Submit body to API: `{ category, competitors: [competitor], audience: audience || undefined, goal, platforms: ["reddit"] }`.
- **Acceptance:** All inputs are shadcn (no native `<select>`/`<input>` raw). `grep` for `<select` or `<input` (uncomponentized) inside this file returns 0. Form validates client-side before submit. On error, form stays interactive.

### Task 6.5 — Rewrite `routes/home.tsx` [sequential after 6.1/6.2/6.4]
- **File:** `packages/web/src/routes/home.tsx` (overwrite)
- **Action:** Component tree from spec §4.1: `<SiteHeader />` + centered `max-w-2xl` column with `<Hero />` + `<CompetitorForm />` + footnote "Reddit-only for now. More sources coming." (`text-xs text-muted-foreground`).
- **Acceptance:** No raw `<input>` / `<select>` left in the file. Submitting valid form navigates to `/reports/:id`. Submitting invalid shows inline field errors.

### Phase 6 verification
- `pnpm --filter @rivaleye/web type-check` passes.
- Manual: type a competitor → click Generate → URL advances to `/reports/<uuid>`.
- localStorage key `rivaleye.history.v1` populated with the new entry.

---

## Phase 7 — Report page (AnswerHero + 9 sections + skeleton + export)

Goal: replace `routes/report.tsx` with the spec §4.2 long-scroll layout.

All section components in this phase live under `packages/web/src/components/report/` and are presentational (props in, JSX out). They are independently parallel-safe except where called out.

### Task 7.1 — Move and re-export `PainClusterCard` [sequential — touches existing file]
- **File:** `packages/web/src/components/report/pain-cluster-card.tsx` (new), delete `packages/web/src/components/pain-cluster-card.tsx`
- **Action:** Move file. Update import in `routes/report.tsx` (deferred to 7.13). Keep API identical.
- **Acceptance:** Old path removed. New path imports cleanly.

### Task 7.2 — `StatusBadge` [parallel-safe]
- **File:** `packages/web/src/components/report/status-badge.tsx` (new)
- **Action:** Extract from current `routes/report.tsx`. Take `status: ReportStatus`. Use Tailwind tokens only — no hex. Map: queued→muted, running→accent (acid green muted), completed→primary, failed→destructive. Icon: `Clock | Loader2 | CheckCircle2 | XCircle` from lucide.
- **Acceptance:** No raw hex/rgb in file. Renders for all 4 statuses.

### Task 7.3 — `StageIndicator` [parallel-safe]
- **File:** `packages/web/src/components/report/stage-indicator.tsx` (new)
- **Action:** 3-step horizontal stepper: Queued → Scraping → Clustering. Active step computed from spec §4.2:
  - `queued` → step 1
  - `running` && output null → step 2
  - `running` && output present → step 3
  - `completed` → return null (hidden)
- **Acceptance:** Visual progression; uses Tailwind tokens only.

### Task 7.4 — `ReportHeader` [parallel-safe]
- **File:** `packages/web/src/components/report/report-header.tsx` (new)
- **Action:** Render: H1 with first competitor name; pills below: category, goal (using `GOAL_LABELS`), report id (`font-mono text-xs`), `<StatusBadge>`. Right side: export menu (Copy link, Copy as Markdown, Download .md) — implemented as a row of 3 shadcn `<Button variant="ghost" size="sm">`s with `Copy`/`Download` icons. Each calls the corresponding helper from `lib/report-to-markdown.ts` (Task 7.15) or `navigator.clipboard.writeText(window.location.href)`. Success → sonner toast.
- **Acceptance:** Copy link writes to clipboard and fires toast. Download triggers `.md` blob. Goal label localized via `GOAL_LABELS`.

### Task 7.5 — `AnswerHero` [parallel-safe]
- **File:** `packages/web/src/components/report/answer-hero.tsx` (new)
- **Action:** Pinned top block (spec §4.2.1 section 2). Uses `pickAnswerHeroData(output)` from Task 2.3. Three sub-blocks: "Top 3 Opportunities" (numbered list, `font-mono` arrow `→`), "Strongest Positioning Angle" (single line), "Best Wedge" (single line). Accent acid-green border-left. If all three derived fields empty, render single-line fallback "Top finding: <first pain cluster title>" — never collapse.
- **Acceptance:** Renders with empty arrays without crashing. Accent acid-green visible.

### Task 7.6 — `ExecutiveSummary` [parallel-safe]
- **File:** `packages/web/src/components/report/executive-summary.tsx` (new)
- **Action:** Card with H2 "Summary" and `output.summary` paragraph. Returns `null` when summary empty.
- **Acceptance:** Hidden when blank.

### Task 7.7 — `PainClustersSection` [parallel-safe]
- **File:** `packages/web/src/components/report/pain-clusters-section.tsx` (new)
- **Action:** Wraps `output.painClusters` in a 2-col grid of `<PainClusterCard>`. H2 "Pain Clusters". Hidden when empty.
- **Acceptance:** Empty array → `null`. Non-empty → grid.

### Task 7.8 — Simple list sections [parallel-safe — 4 separate files]
- **Files:**
  - `packages/web/src/components/report/feature-gaps-section.tsx`
  - `packages/web/src/components/report/pricing-pain-section.tsx`
  - `packages/web/src/components/report/switching-signals-section.tsx`
  - `packages/web/src/components/report/competitor-weaknesses-section.tsx`
- **Action:** Each takes its slice of `output`, renders H2 + bulleted (`<ul>` with `·` bullets) or single-paragraph (pricing pain). Returns `null` when slice empty.
- **Acceptance:** Each component hidden when its data slice empty.

### Task 7.9 — `VoiceOfCustomerSection` + `QuoteCard` [parallel-safe]
- **Files:**
  - `packages/web/src/components/report/voice-of-customer-section.tsx`
  - `packages/web/src/components/report/quote-card.tsx`
- **Action:** `output.voiceOfCustomer` is `string[]` in the current shape; render each as a `<QuoteCard>` (card with `“` quote mark, mono attribution if available — here none, so just the quote text). H2 "Voice of customer". Hidden when empty.
- **Acceptance:** Hidden when array empty. Renders stack on non-empty.

### Task 7.10 — Numbered list sections [parallel-safe — 3 separate files]
- **Files:**
  - `packages/web/src/components/report/product-opportunities-section.tsx`
  - `packages/web/src/components/report/positioning-angles-section.tsx`
  - `packages/web/src/components/report/recommended-actions-section.tsx`
- **Action:** Each renders numbered list (`<ol>`) of the corresponding `string[]`. `recommended-actions` uses checkbox-styled markers (visual only — pure CSS, no state). Larger type on `productOpportunities` (`text-base`). H2 in each. Hidden when array empty.
- **Acceptance:** Each section hidden when slice empty.

### Task 7.11 — `SourceEvidenceSection` [parallel-safe]
- **File:** `packages/web/src/components/report/source-evidence-section.tsx` (new)
- **Action:** shadcn `<Accordion type="single" collapsible>` collapsed by default. One item per pain cluster, body lists `cluster.evidence` strings. Hidden when `painClusters` empty.
- **Acceptance:** Closed by default. Expands on click.

### Task 7.12 — `ReportSkeleton` [parallel-safe]
- **File:** `packages/web/src/components/report/report-skeleton.tsx` (new)
- **Action:** Hero skeleton: 3 long bars + 2 short bars (shadcn `<Skeleton>`). 4-card placeholder grid for pain clusters. Used while `status` is `queued | running`.
- **Acceptance:** Renders without props.

### Task 7.13 — Rewrite `routes/report.tsx` [sequential — depends on 7.1–7.12 + 7.15]
- **File:** `packages/web/src/routes/report.tsx` (overwrite)
- **Action:** Compose:
  - `<SiteHeader />`
  - `max-w-3xl` centered column, `space-y-10`.
  - `useReport(id)`. Branch on status:
    - `isError` or 404 → "Report doesn't exist" alert + Start new CTA.
    - `failed` → destructive `<Alert>` (spec §4.2.2).
    - `queued | running` → `<ReportHeader>` (without export controls — or grey them out) + `<StageIndicator>` + `<ReportSkeleton>`.
    - `completed` → `<ReportHeader>` + `<AnswerHero>` + `<ExecutiveSummary>` + `<PainClustersSection>` + `<FeatureGapsSection>` + `<PricingPainSection>` + `<SwitchingSignalsSection>` + `<VoiceOfCustomerSection>` + `<CompetitorWeaknessesSection>` + `<ProductOpportunitiesSection>` + `<PositioningAnglesSection>` + `<RecommendedActionsSection>` + `<SourceEvidenceSection>`.
  - Wrap completed render in a React error boundary (`<ReportErrorBoundary>`, see Task 9.2) — on render error, full-width alert + Copy link.
- **Acceptance:** All section components rendered conditionally; no raw `<input>` / `<select>`; no hex colors; type-check passes.

### Task 7.14 — Poll resilience toast [sequential after 7.13]
- **File:** `packages/web/src/hooks/queries/use-report.ts` (edit)
- **Action:** Extend hook: on 3rd consecutive failed fetch (track via `failureCount` from query state), fire one `sonner.toast.error("Reconnecting…")`. Do not change `refetchInterval` behavior.
- **Acceptance:** Toast appears once after 3 sequential errors (manually: stop API, observe). Polling continues.

### Task 7.15 — `report-to-markdown.ts` helper [parallel-safe — separate file]
- **File:** `packages/web/src/lib/report-to-markdown.ts` (new)
- **Action:** Pure function `reportToMarkdown(row: ReportRow): string` that serializes the rendered report sections to Markdown. Section order matches spec §4.2.1. Skip sections whose data slice is empty. Also export `downloadMarkdown(filename, md)` that triggers a Blob download.
- **Acceptance:** Deterministic; trims trailing whitespace; valid Markdown for all sections present in `PainReportOutput`.

### Phase 7 verification
- `pnpm --filter @rivaleye/web type-check` passes.
- Manual: complete a report (or seed a `completed` row in dev DB). Visit `/reports/:id` and confirm:
  - AnswerHero visible at top.
  - All 9 sections render in spec order.
  - Empty sections hidden.
  - Copy link toast fires.
  - Download `.md` triggers a file with all visible sections.

---

## Phase 8 — History page

Goal: replace stub with the real history list.

### Task 8.1 — `EmptyState` component [parallel-safe within phase 8]
- **File:** `packages/web/src/components/history/empty-state.tsx` (new)
- **Action:** Centered card: "No reports yet." + `<Link to="/">Generate your first one.</Link>`
- **Acceptance:** Renders without props.

### Task 8.2 — `HistoryTable` component [parallel-safe]
- **File:** `packages/web/src/components/history/history-table.tsx` (new)
- **Action:** Props: `rows: Array<{ id; competitor; goal; createdAt; status?; competitorsFromServer? }>`. Uses shadcn `<Table>`. Columns: Competitor | Goal | Created | Status | "Open" (link to `/reports/:id`). Goal label via `GOAL_LABELS`. Status uses `<StatusBadge>` if known, else label "unknown" muted.
- **Acceptance:** Renders both server-known and server-unknown rows.

### Task 8.3 — `ClearHistoryButton` [parallel-safe]
- **File:** `packages/web/src/components/history/clear-history-button.tsx` (new)
- **Action:** shadcn `<AlertDialog>` triggered by a destructive `<Button>` "Clear history". On confirm: `clearHistory()`, then invalidate the history query (TanStack) and refresh local state. Uses `Trash2` icon.
- **Acceptance:** Native `window.confirm` not used. Dialog appears. Cancel keeps data.

### Task 8.4 — `routes/history.tsx` [sequential — depends on 8.1/8.2/8.3]
- **File:** `packages/web/src/routes/history.tsx` (overwrite)
- **Action:**
  - On mount: `useState(() => getHistory().reports)` — synchronous read.
  - `useReports()` for server enrichment (existing hook).
  - Compute rows: intersect server `reports` by id with local entries. For server-missing local ids: include row with `status: "unknown"`.
  - Loading state (API): 3-row `<Skeleton>` table.
  - Empty (no local IDs): `<EmptyState>`.
  - API error: `<Alert>` + retry button. Still render local-only rows below as plain links.
  - Render `<HistoryTable>` + `<ClearHistoryButton>` (bottom right).
- **Acceptance:** With localStorage disabled, renders empty state without crashing. Local ID not present in API response still renders with "unknown" status and working link.

### Phase 8 verification
- `pnpm --filter @rivaleye/web type-check` passes.
- Manual: create a report from Home → confirm row appears at `/history` with status updating from queued → completed over polling/refocus. Clear history works.

---

## Phase 9 — Polish: loading states, error boundary, empty guards

Goal: make sure spec §9 state matrix is covered everywhere.

### Task 9.1 — Verify per-section empty guards [parallel-safe — read-only audit, then patches if needed]
- **Files:** `packages/web/src/components/report/*-section.tsx`
- **Action:** Grep each section file: every one must early-return `null` when its slice is empty (`array.length === 0` or `!string`). Patch any missed.
- **Acceptance:** With a `completed` row that has empty `featureGaps`, the Feature Gaps section is absent from the DOM.

### Task 9.2 — `ReportErrorBoundary` [sequential — touches `routes/report.tsx`]
- **File:** `packages/web/src/components/report/report-error-boundary.tsx` (new), `packages/web/src/routes/report.tsx` (wrap)
- **Action:** Class component with `componentDidCatch`. Renders destructive `<Alert>` with "Something went wrong rendering the report" + Copy link button. Wraps the completed-state branch in `routes/report.tsx`.
- **Acceptance:** Throwing inside any section component shows the alert, not a white screen.

### Task 9.3 — Loading states audit [parallel-safe]
- **Action:** Confirm:
  - Home: button busy state with `Loader2` while mutation pending.
  - Report: `<ReportSkeleton>` during queued/running.
  - History: 3-row skeleton table during `useReports()` loading.
- **Acceptance:** No blank/white state on any page during data fetch.

### Task 9.4 — Hex/rgb grep gate [parallel-safe]
- **Action:** Run `grep -rE "#[0-9a-fA-F]{3,6}|rgb\(" packages/web/src --include='*.tsx'`. Must return 0 hits. Patch any offenders.
- **Acceptance:** 0 hits.

### Phase 9 verification
- `pnpm --filter @rivaleye/web type-check` passes.
- `pnpm --filter @rivaleye/web lint` passes.

---

## Phase 10 — Verification & golden-path smoke test

### Task 10.1 — Type-check + build [sequential]
- **Action:**
  - `pnpm --filter @rivaleye/web type-check`
  - `pnpm --filter @rivaleye/web build`
- **Acceptance:** Both commands exit 0.

### Task 10.2 — Lint [sequential]
- **Action:** `pnpm --filter @rivaleye/web lint`
- **Acceptance:** Exits 0.

### Task 10.3 — Hex/rgb final grep [parallel-safe with 10.2]
- **Action:** `grep -rE "#[0-9a-fA-F]{3,6}|rgb\(" packages/web/src --include='*.tsx'`
- **Acceptance:** 0 hits.

### Task 10.4 — Manual browser smoke test (golden path) [sequential]
- **Pre-req:** API running on `:6090`, worker running, Postgres reachable.
- **Steps:**
  1. `pnpm --filter @rivaleye/web dev`, visit `http://localhost:4004/`.
  2. Confirm Cold Steel dark theme; Geist font loaded (DevTools → Network → woff).
  3. Fill form: competitor "Notion", category "productivity", optional audience "PMs", goal default. Submit.
  4. Verify redirect to `/reports/<uuid>`; skeleton + stage indicator visible.
  5. Wait until status → `completed` (polling every 3s).
  6. Verify AnswerHero pinned at top with 3 opportunities, positioning angle, wedge.
  7. Verify all sections present that have data; empty sections absent.
  8. Click Copy link → toast appears, clipboard has URL.
  9. Click Download .md → file downloads with section content.
  10. Visit `/history` → row for the new report present with status pill.
  11. Click row → returns to the report page.
  12. Clear history → confirm dialog → list empties.
  13. Visit `/garbage` → NotFound page.
- **Acceptance:** Every step passes without console errors.

---

## Plan summary

- **Phases:** 11 (Phase 0 through Phase 10).
- **Tasks total:** 36
  - Phase 0: 2
  - Phase 1: 3
  - Phase 2: 3
  - Phase 3: 1
  - Phase 4: 1
  - Phase 5: 3
  - Phase 6: 5
  - Phase 7: 15
  - Phase 8: 4
  - Phase 9: 4
  - Phase 10: 4
  *(Note: section subtasks 7.8 and 7.10 expand to 4 + 3 files respectively; count above treats each numbered task as one unit.)*
- **Parallel-safe-heavy phases:** Phase 1 (1.1, 1.2 parallel; 1.3 sequential), Phase 2 (all 3 parallel), Phase 5 (5.2, 5.3 parallel), Phase 6 (6.1, 6.2, 6.3 parallel; 6.4 depends on 6.3; 6.5 depends on others), Phase 7 (all section components 7.2–7.12 + 7.15 parallel-safe; 7.13 sequential aggregator; 7.14 sequential), Phase 8 (8.1, 8.2, 8.3 parallel; 8.4 sequential), Phase 9 (9.1, 9.3, 9.4 parallel; 9.2 sequential), Phase 10 (10.3 parallel with 10.2; rest sequential).
- **Strictly sequential phases:** Phase 0 (install before generate), Phase 3 (single task), Phase 4 (single task).

## Cross-cutting constraints (re-asserted)

- No raw hex/rgb in `.tsx` files. Tokens only.
- No native `<select>` / `<input>` outside shadcn wrappers.
- All `localStorage` access goes through `src/lib/local-history.ts`.
- All server state through TanStack Query hooks under `src/hooks/queries/`.
- All forms via react-hook-form + zod.
- Polling: 3000ms, stop on `completed | failed`. Already implemented; do not change.
- Confirmations: shadcn `<AlertDialog>`. No `window.confirm`.
- Default theme: dark (`<html class="dark">`); no toggle in MVP.
- Reddit only: `platforms: ["reddit"]` in API submission, no platform UI.
- No auth, no better-auth client wiring.
- Markdown export only — no PDF.
