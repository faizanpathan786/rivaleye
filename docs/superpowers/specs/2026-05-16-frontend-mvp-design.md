# RivalEye v3 — Frontend MVP Design Spec

Date: 2026-05-16
Scope: `packages/web/` — Vite + React + TS + Tailwind + shadcn/ui
Status: Design only. No code. No `packages/` edits implied.

This spec replaces the current stub UI under `packages/web/src/` with a sharp, opinionated MVP for anonymous, Reddit-only pain-report generation. It assumes the API shape currently exported from `@rivaleye/api` (see `packages/api/src/controllers/reports/`) and the report output shape in `packages/shared/src/types/index.ts` (`PainReportOutput`).

---

## 1. Product framing (locked)

- **Hero promise:** "Find what your competitor's users hate."
- **One funnel:** Home form → POST `/v1/reports` → redirect to `/reports/:id` → poll until complete → render long-scroll report.
- **No auth in MVP.** Reports are addressable by UUID in the URL. The "history" page is a local-storage-backed list of report IDs created on this device.
- **One source in MVP UI: Reddit.** The platforms array sent to the API is always `["reddit"]`. The form does not expose a platform selector. The report UI never names other platforms.
- **Founder goal is first-class.** Sent on create, displayed on the report header, used (later) to bias LLM clustering. Not gated.
- **Single long scroll on the report page.** Top-of-page hero block pins the answer the founder actually came for (top 3 opportunities + strongest positioning angle + best wedge). Then the long form. No tabs, no sidebar.

---

## 2. URL routes

| Path | Component | Purpose |
|---|---|---|
| `/` | `HomePage` | Hero + competitor form. Submits to API, redirects on success. |
| `/reports/:id` | `ReportPage` | Polls report by ID. Renders skeleton-with-stage during work, full report on complete. |
| `/history` | `HistoryPage` | Lists report IDs persisted in `localStorage` for this device, with status badges (live-refetched). |
| `*` | `NotFoundPage` | Plain 404 with "Start a new report" CTA back to `/`. |

Router config lives in `src/app.tsx` (already uses `createBrowserRouter`). Add the new routes alongside existing ones. No nested routes, no loaders/actions — TanStack Query owns data fetching.

---

## 3. Data flow

### 3.1 API endpoints used (no new endpoints required)

| Endpoint | Used by | Notes |
|---|---|---|
| `POST /v1/reports` | `HomePage` form submit | Body: `{ category, competitors: [name], audience?, goal, platforms: ["reddit"] }`. Returns `{ id, status }`. |
| `GET /v1/reports/:id` | `ReportPage` poll | Returns full `ReportRow` (see `packages/web/src/lib/api.ts`). |
| `GET /v1/reports` | `HistoryPage` enrichment (optional) | Used only to enrich locally-tracked IDs with current `status` + `competitors`. Filtered client-side against the local-storage ID set. If the list endpoint grows past 100 rows in dev, switch to per-id parallel `GET /:id`. |

API client lives at `src/lib/api.ts` (already exists, keep shape). No new client methods needed.

### 3.2 TanStack Query hooks (under `src/hooks/queries/`)

| Hook | File | Query key | Calls | Notes |
|---|---|---|---|---|
| `useReport(id)` | `use-report.ts` (exists) | `["report", id]` | `api.reports.get(id)` | `refetchInterval` returns `false` once `status` is `completed` \| `failed`, else `3000`. Keep current implementation. |
| `useReports()` | `use-report.ts` (exists) | `["reports"]` | `api.reports.list()` | Used by `HistoryPage` to enrich local IDs. Stale time 30s. |
| `useCreateReport()` | `use-create-report.ts` (new) | mutation | `api.reports.create(input)` | On success: `localStorage` push (see §6), then `navigate(/reports/:id)`. Surfaces `error` for the form. |

No optimistic updates. No global state store. UI state stays local (`useState` / `useReducer`).

---

## 4. Pages

### 4.1 Home (`/`)

**Purpose:** Hero + a single form. One CTA. No marketing fluff in MVP.

**Layout (single column, centered, max-w-2xl):**

```
Header (sticky, transparent, just logo + "History" link, right-aligned)
Hero block
  H1: "Find what your competitor's users hate."
  Sub: "Paste a competitor. Get a Reddit pain report in ~2 minutes. No signup."
CompetitorForm (card, bordered, soft shadow)
Footnote: "Reddit-only for now. More sources coming."
```

**Component tree:**

```
HomePage
├── SiteHeader                  (custom — used on every page)
│   ├── Logo (text)
│   └── nav: <Link to="/history">Recent reports</Link>
├── Hero                        (custom; pure presentational)
└── CompetitorForm              (custom; src/components/report/competitor-form.tsx)
    ├── shadcn <Form> (react-hook-form + zod)
    ├── shadcn <Input>          competitor name
    ├── shadcn <Input>          category
    ├── shadcn <Input>          target audience (optional)
    ├── shadcn <Select>         founder goal
    ├── shadcn <Button>         "Generate pain report"
    └── inline error banner (shadcn <Alert variant="destructive">)
```

**Form schema (zod, in `src/components/report/competitor-form.schema.ts`):**

```
{
  competitor: string().min(1, "Enter a competitor name").max(80),
  category: string().min(1, "What category is this?").max(80),
  audience: string().max(120).optional(),
  goal: enum([
    "find_user_pain",
    "find_weaknesses",
    "improve_positioning",
    "validate_idea",
    "decide_mvp_features",
    "compare_alternatives",
  ])
}
```

Goals display labels (in order shown):

1. `find_user_pain` — "Find what users hate" (default)
2. `find_weaknesses` — "Find competitor weaknesses"
3. `improve_positioning` — "Improve my positioning / landing page"
4. `validate_idea` — "Validate my idea"
5. `decide_mvp_features` — "Decide MVP features"
6. `compare_alternatives` — "Compare alternatives"

Goal default in UI is `find_user_pain` (matches hero copy promise).

**Replaces existing route file** `packages/web/src/routes/home.tsx` (currently a single-file form with native `<select>` and raw `<input>`s — violates `packages/web/CLAUDE.md` §7 "never use native `<select>`"). The new version uses shadcn `Form`/`Input`/`Select`. Category becomes a free-text `<Input>` (the current hardcoded category list is dropped — too restrictive, and `category` is just a string field in the DB).

**Competitors as array:** MVP UI accepts one competitor name in the visible input, but submits the API field as `competitors: [name]`. A second/third competitor input is out of scope (PRD §14 says answer-first, not comparison-first).

**Submit flow:**
1. Validate via zod.
2. Call `useCreateReport().mutate(values)`.
3. On success: persist `{ id, competitor, createdAt }` to `localStorage` (§6), then `navigate("/reports/" + id)`.
4. On error: show inline `<Alert>` with the error message; form stays interactive.

**States:**
- `idle` — form interactive.
- `submitting` — button shows `<Loader />` icon + "Generating…", form inputs disabled.
- `error` — `<Alert>` above the button.
- No empty/loading states (no data is read on this page).

---

### 4.2 Report (`/reports/:id`)

**Purpose:** Show progress while the worker runs, then render the long-form report — answer-first.

**Polling strategy (already implemented; document it):**
- `useReport(id)` polls `GET /v1/reports/:id` every **3000ms**.
- Stop condition: `status === "completed"` OR `status === "failed"` (handler returns `false` from `refetchInterval`).
- React Query handles tab-visibility automatically; no custom backoff.
- If poll itself errors (network / 5xx), TanStack Query retries with its default policy. Surface a non-blocking toast on third consecutive failure (shadcn `<Toast>` via `sonner`).

**Loading / status states:**

```
queued     → Skeleton hero + stage indicator "Queued — starting shortly…"
running    → Skeleton hero + stage indicator "Scraping Reddit and clustering pain points…"
failed     → Full-width <Alert variant="destructive"> with retry CTA back to "/"
completed  → Full report (see §4.2.1)
```

Stage indicator is a small horizontal stepper at the top of the report area (Queued → Scraping → Clustering → Done). Worker doesn't yet emit fine-grained stages — for MVP we infer:
- `status=queued` → step 1 active
- `status=running` AND `output` is null → step 2 active
- `status=running` AND `output` partially populated → step 3 active (future-proofing; today this branch likely never fires)
- `status=completed` → all done, indicator hides

**Skeleton:** Use shadcn `Skeleton` blocks shaped like the hero summary (3 long bars + 2 short) and 4 pain-cluster card placeholders in a 2-col grid. No spinner-only state — skeleton-with-stage replaces it.

#### 4.2.1 Completed report layout (single long scroll)

Order is locked by PRD §14: **answer first**. Each section is a `<section>` with a sticky-nav-friendly `id`. No tabs. No sidebar. Max width `max-w-3xl` centered.

```
1. <ReportHeader>                  competitor name + category + goal pill + status badge + export menu
2. <AnswerHero>                    THE ANSWER, pinned at top
   ├─ Top 3 Opportunities          (top 3 of output.productOpportunities)
   ├─ Strongest Positioning Angle  (output.positioningAngles[0])
   └─ Best Wedge                   (top 1 of output.competitorWeaknesses, or fallback first pain cluster title)
3. <ExecutiveSummary>              output.summary
4. <PainClusters>                  grid of <PainClusterCard> (already exists; reuse)
5. <FeatureGaps>                   bulleted list
6. <PricingPain>                   single block (output.pricingPain string)
7. <SwitchingSignals>              bulleted list
8. <VoiceOfCustomer>               stacked quote cards (custom <QuoteCard>)
9. <CompetitorWeaknesses>          bulleted list with emphasis
10. <ProductOpportunities>         numbered list, larger type
11. <PositioningAngles>            numbered list
12. <RecommendedActions>           numbered list, action-styled checkboxes (visual only — no persistence)
13. <SourceEvidence>               shadcn <Accordion> — collapsed by default; expands to show raw evidence per cluster
```

**Empty/partial-data tolerance:** Each section guards on its slice being non-empty (`array.length > 0` or string truthy). If the LLM returns an empty section, the section is hidden entirely — no "no data" placeholders cluttering the scroll. If `AnswerHero` source fields are empty, it falls back to a single-line "Top finding: <first pain cluster title>" so the hero never collapses.

**Export / share controls (in `<ReportHeader>` right side):**

| Control | Behavior | Implementation hint |
|---|---|---|
| Copy link | Copies `window.location.href` | navigator.clipboard, toast on success |
| Copy as Markdown | Serializes the rendered report to a Markdown string | Pure client function `report-to-markdown.ts` in `src/lib/`; no API call |
| Download `.md` | Same as above, then triggers download via Blob | One client helper |

PDF export is out of scope for MVP (see §10).

#### 4.2.2 Failed state

Replaces report body with:

```
<Alert variant="destructive">
  Report generation failed.
  [optional error message if present in row]
  <Button onClick={() => navigate("/")}>Start a new report</Button>
</Alert>
```

#### 4.2.3 404 (report ID not found)

API returns 404; TanStack Query surfaces `isError`. Show:

```
This report doesn't exist (or it was deleted).
<Button as={Link} to="/">Start a new report</Button>
```

---

### 4.3 History (`/history`)

**Purpose:** Anonymous "recent reports on this device" list. No auth means this is the only persistence layer between sessions.

**Layout:**

```
SiteHeader
H1 "Recent reports"
Sub  "Saved on this device only. Clearing browser data wipes this list."
<Table> (shadcn)
  columns: Competitor | Goal | Created | Status | <Link to report />
Empty state if localStorage list is empty.
```

**Component tree:**

```
HistoryPage
├── SiteHeader
├── shadcn <Table>
│   └── rows from useHistoryRows()
├── EmptyState (custom) — "No reports yet. <Link to='/'>Generate your first one.</Link>"
└── ClearHistoryButton (shadcn <AlertDialog> confirmation)
```

**Data flow:**
1. Read local IDs from `localStorage` (see §6) synchronously on mount.
2. Call `useReports()` to fetch all rows from API.
3. Intersect: only rows whose `id` is in local set are shown. (Why intersect server-side data instead of trusting local entries: keeps status + competitor names accurate even if the user edits localStorage by hand.)
4. If `useReports()` is unavailable (or returns too much in the future), fall back to per-id `useReport()` queries via `useQueries`. Out of scope for MVP unless `/v1/reports` is paginated.

**States:**
- `loading` (API): show 3-row `<Skeleton>` table.
- `empty` (no local IDs): EmptyState component.
- `error` (API): inline `<Alert>` with retry button; still show the bare IDs from localStorage as plain links so the user can still reach their reports.
- `partial` (local ID not present in API response): row still rendered, status `"unknown"`, link still works.

---

## 5. Polling strategy — canonical reference

For both the live report page and the history page:

| Trigger | Interval | Stop condition | Source |
|---|---|---|---|
| Report page | 3000 ms | `status` ∈ `{completed, failed}` | Already implemented in `use-report.ts` |
| History page | none (one-shot) | n/a | Refetches on tab focus (TanStack default) |

We do not increase polling frequency on the report page even on first load — backend says reports take 1–3 minutes; 3s gives a snappy feel without hammering the API.

---

## 6. LocalStorage schema (anonymous history)

**Key:** `rivaleye.history.v1`

**Value (JSON):**

```ts
type LocalHistory = {
  version: 1;
  reports: Array<{
    id: string;           // uuid from POST /v1/reports response
    competitor: string;   // first competitor entered, for display before server round-trip
    goal: ReportGoal;     // for offline display
    createdAt: string;    // ISO timestamp (client clock, just for sort)
  }>;
};
```

**Rules:**
- Capped at 50 entries. On overflow, drop oldest by `createdAt`.
- All read/write via a single helper `src/lib/local-history.ts` exposing `getHistory()`, `addReport()`, `removeReport(id)`, `clearHistory()`.
- Helper is the only place that touches `localStorage`. Never read the key directly from components.
- Version field exists so a future migration can rewrite the shape without colliding.
- "Clear history" UI on `/history` is destructive; gated by shadcn `<AlertDialog>`.

---

## 7. Design tokens

PRD §13 calls for "sharp, opinionated, founder-friendly." Translation: dark by default, high contrast, monospace for data, single accent. Not corporate. Not pastel. The current `globals.css` uses generic shadcn defaults — replace with the tokens below.

### 7.1 Color palette

Theme name: **Cold Steel** (dark default, light optional).

Single accent color: a sharp acid green `#7CFFB2` (HSL `144 100% 74%`) — reads like a terminal-prompt highlight, signals "data" not "brand." Used sparingly: primary button, key numbers, link hover, accent borders on the AnswerHero block.

Dark theme (default — `dark` class on `<html>`):

| Token | HSL | Use |
|---|---|---|
| `--background` | `220 13% 8%` | page bg |
| `--foreground` | `210 20% 96%` | body text |
| `--card` | `220 13% 11%` | card bg |
| `--card-foreground` | `210 20% 96%` | card text |
| `--muted` | `220 10% 16%` | subtle surfaces |
| `--muted-foreground` | `220 8% 60%` | secondary text |
| `--border` | `220 13% 18%` | hairlines |
| `--input` | `220 13% 16%` | input bg |
| `--ring` | `144 100% 74%` | focus ring (acid green) |
| `--primary` | `144 100% 74%` | acid green |
| `--primary-foreground` | `220 13% 8%` | text on primary |
| `--accent` | `144 100% 74%` | accent (same as primary in MVP) |
| `--accent-foreground` | `220 13% 8%` | |
| `--destructive` | `0 75% 60%` | red |
| `--destructive-foreground` | `210 20% 96%` | |
| `--radius` | `0.5rem` | tight corners — sharp, not bubbly |

Light theme (toggle off-by-default; not required for MVP but tokens defined so we don't paint ourselves into a dark-only corner):

| Token | HSL |
|---|---|
| `--background` | `0 0% 100%` |
| `--foreground` | `220 13% 10%` |
| `--card` | `0 0% 100%` |
| `--muted` | `220 14% 96%` |
| `--muted-foreground` | `220 10% 40%` |
| `--border` | `220 14% 88%` |
| `--primary` | `144 70% 38%` (darker green for AA contrast on white) |
| `--primary-foreground` | `0 0% 100%` |
| `--ring` | `144 70% 38%` |
| `--destructive` | `0 75% 50%` |

No theme toggle in MVP UI. Default `dark` class on `<html>`.

### 7.2 Typography

Two families. No icon fonts.

- **Body / UI:** [Geist Sans](https://vercel.com/font) (or Inter as fallback). Sans, neutral, condensed counters — reads tight at small sizes.
- **Data / accents:** [Geist Mono](https://vercel.com/font) (or JetBrains Mono fallback). Used for:
  - Numbers in cluster cards ("12 quotes")
  - Report ID in the URL bar of `<ReportHeader>`
  - Goal pill text
  - Code-like accents in `<AnswerHero>` ("→ Top 3 Opportunities")

Tailwind config additions:

```
fontFamily: {
  sans: ['Geist Sans', 'Inter', 'ui-sans-serif', 'system-ui', ...],
  mono: ['Geist Mono', 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', ...],
}
```

Type scale (Tailwind defaults are fine; document the intentional choices):

| Use | Class |
|---|---|
| H1 hero | `text-4xl md:text-5xl font-semibold tracking-tight` |
| H2 section | `text-xl font-semibold tracking-tight` |
| H3 card title | `text-base font-semibold leading-snug` |
| Body | `text-sm leading-relaxed` |
| Caption/muted | `text-xs text-muted-foreground` |
| Mono data | `font-mono text-xs tracking-tight` |

### 7.3 Spacing, motion, surfaces

- Spacing scale: Tailwind defaults; sections inside report use `space-y-10`; cards inside a section use `space-y-3`/`gap-4`.
- Border radius: 6–8px (`--radius: 0.5rem`). No fully rounded buttons. Sharper = more "tool," less "consumer."
- Shadows: minimal. `shadow-sm` on cards in dark mode is invisible; rely on borders.
- Motion: `transition-colors` and `transition-transform` only. No bounce. No framer-motion in MVP.
- Focus rings: 2px outline using `--ring` (acid green). Visible, not subtle.

### 7.4 Iconography

`lucide-react` only. Curated set used in MVP:

- `ArrowRight` — CTAs
- `Loader2` — submitting / loading
- `CheckCircle2` — completed status
- `XCircle` — failed status
- `Clock` — queued / running
- `Copy` — copy buttons
- `Download` — export
- `ChevronDown` — accordion
- `Trash2` — clear history

---

## 8. File structure under `packages/web/src/`

```
src/
  app.tsx                                   ← add /history route + NotFound
  main.tsx                                  ← unchanged
  routes/
    home.tsx                                ← rewrite to use new CompetitorForm
    report.tsx                              ← rewrite to use new section components
    history.tsx                             ← new
    not-found.tsx                           ← new
  components/
    ui/                                     ← shadcn primitives (run shadcn add)
      button.tsx
      input.tsx
      label.tsx
      select.tsx
      form.tsx
      alert.tsx
      alert-dialog.tsx
      card.tsx
      skeleton.tsx
      accordion.tsx
      table.tsx
      toast.tsx (sonner)
    site/
      site-header.tsx                       ← logo + history link
    report/
      competitor-form.tsx
      competitor-form.schema.ts
      report-header.tsx                     ← title + goal pill + status badge + export menu
      status-badge.tsx                      ← extract from report.tsx
      stage-indicator.tsx                   ← stepper for queued/running
      answer-hero.tsx                       ← pinned top-3-opps + positioning + wedge
      executive-summary.tsx
      pain-cluster-card.tsx                 ← already exists; keep
      pain-clusters-section.tsx
      feature-gaps-section.tsx
      pricing-pain-section.tsx
      switching-signals-section.tsx
      voice-of-customer-section.tsx
      quote-card.tsx
      competitor-weaknesses-section.tsx
      product-opportunities-section.tsx
      positioning-angles-section.tsx
      recommended-actions-section.tsx
      source-evidence-section.tsx           ← accordion
      report-skeleton.tsx                   ← used while polling
    history/
      history-table.tsx
      clear-history-button.tsx
      empty-state.tsx
  hooks/
    queries/
      use-report.ts                         ← unchanged
      use-create-report.ts                  ← new (mutation)
  lib/
    api.ts                                  ← unchanged shape
    utils.ts                                ← cn() — unchanged
    local-history.ts                        ← new (localStorage adapter)
    report-to-markdown.ts                   ← new (pure serializer)
  styles/
    globals.css                             ← replace tokens with Cold Steel palette
```

Naming: kebab-case files, PascalCase exports (per `packages/web/CLAUDE.md` §9). All named exports. No defaults.

---

## 9. State / loading / error matrix (per page)

| Page | Loading | Empty | Error |
|---|---|---|---|
| `/` (Home) | n/a (no fetch) | n/a | Form-level `<Alert>` on submit failure; form remains usable |
| `/reports/:id` (queued) | Skeleton + StageIndicator "Queued" | n/a | If poll errors 3× consecutively, sonner toast "Reconnecting…", keep polling |
| `/reports/:id` (running) | Skeleton + StageIndicator "Scraping/Clustering" | n/a | Same as above |
| `/reports/:id` (completed) | n/a | Per-section guards hide empty arrays; AnswerHero fallback to first cluster title | If any section throws on render, error boundary at `<ReportPage>` level shows full-width alert + Copy link |
| `/reports/:id` (failed) | n/a | n/a | Destructive `<Alert>` with retry CTA |
| `/reports/:id` (404) | n/a | n/a | "Report doesn't exist" + Start new |
| `/history` | Skeleton table (3 rows) | EmptyState with link to `/` | `<Alert>` with retry; fall back to plain ID links from localStorage |
| `*` (NotFound) | n/a | n/a | "Page not found" + link home |

---

## 10. Out of scope (do not build in MVP)

- Charts of any kind (no recharts / no nivo).
- Comparison view (multi-competitor side-by-side).
- Alerts / notifications / email digests.
- Team / workspace / multi-user features.
- Billing UI (plans, checkout, Stripe widgets). Pricing $29/$99 is a marketing decision, no UI yet.
- Platform selector. Reddit only.
- Auth UI (no sign-in, sign-up, account settings). better-auth client wiring deferred.
- PDF export. Markdown only for MVP.
- Dark/light theme toggle. Dark only.
- i18n. English only.
- Onboarding tour / tooltips. The form is one screen — if it needs a tour, the form is wrong.
- "Save / share with team" — share-by-URL is the share story.
- Real-time websocket updates. Polling is sufficient for 1–3 minute jobs.

---

## 11. Open questions (do not block on these)

- **Should `competitors` array be exposed as a multi-input in MVP?** Decision: no. PRD §14 says answer-first, and the current API/worker only meaningfully scrapes the first competitor.
- **Should `audience` be required?** Decision: optional. Hidden behind an "Optional details" disclosure in the form so it doesn't bloat the hero.
- **Stage granularity.** Worker currently flips `status` queued→running→completed. If we want true Scraping/Clustering substeps, the worker needs to write to `output.progress` or a new column. Out of scope; UI gracefully degrades.
- **Toast lib.** Default to shadcn's sonner integration. Don't pull in a second toast lib.

---

## 12. Acceptance checklist (for the implementer)

- [ ] All native `<input>` / `<select>` in current `routes/home.tsx` replaced with shadcn `<Input>` / `<Select>` / `<Form>` (compliance with `packages/web/CLAUDE.md` §7).
- [ ] No raw hex/rgb in any component file — `grep -E "#[0-9a-fA-F]{3,6}|rgb\(" src/` returns 0 hits in `.tsx` files (`globals.css` is the only place tokens are defined).
- [ ] Every `useQuery` boundary has a skeleton state.
- [ ] Every list/section guards on empty.
- [ ] `localStorage` accessed only through `src/lib/local-history.ts`.
- [ ] `/history` works with `localStorage` disabled (renders empty state, no crash).
- [ ] Report page renders sensibly with a `completed` row whose `output` has missing optional fields (e.g. empty `featureGaps`).
- [ ] `pnpm --filter @rivaleye/web type-check` and `lint` pass.
- [ ] Tailwind config has `fontFamily.sans` and `fontFamily.mono` extended; Geist fonts loaded in `index.html` via `<link rel="stylesheet">` from a CDN or self-hosted.
- [ ] No new API endpoints required by this spec.
