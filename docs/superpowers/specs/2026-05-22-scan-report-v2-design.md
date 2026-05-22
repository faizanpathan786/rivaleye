# Scan Report v2 — Design Spec

**Date:** 2026-05-22
**Scope:** UI only. No backend, no data pipeline. Mock data only.
**Source:** Anthropic design bundle `RivalEye.html` / `screens-report-v2.jsx`.

## Goal

Replace the four parallel sidebar "views" (Founder / Product / Marketing / Growth)
with a single **unified scan report** that exposes those four as *lenses* on the
same scan data, plus a neutral **Summary** lens as the default. One scan, five
perspectives, switchable in place.

The old `/scan` and `/reports/:id` routes and their files stay fully untouched —
they are kept as reference for later data-pipeline integration.

## Why

The four views are not separate features. They are role-specific readings of the
same scraped data. As sidebar siblings they are redundant and make the product
feel scattered. Folding them into one report with an in-place lens switcher
removes the redundancy and makes the report feel intentional.

## Architecture

### New file: `packages/web/src/routes/scan-report.tsx`

Exports `ScanReportPage`. Contains:

- **`SCAN_DATA`** — self-contained mock constant. Shape:
  - `competitor`: `{ name, domain, scannedAt, sources, platforms[], sentiment }`
  - `competitor.sentiment`: `{ overall, positive, neutral, negative, trend }`
  - `quotes[]`: `{ who, sub, when, score, sentiment, text }`
  - Values ported from bundle `data.js` (Linear / linear.app mock).
  - UI-only. A `TODO(backend)` comment marks it for later API swap.

- **`ScanReportPage`** (the bundle's `ReportV2`): top-level component.
  - `lens` state (`summary | founder | product | marketing | growth`), default `summary`.
  - `range` state (`30d | 90d | 1y | all`), default `90d`.
  - Lens-tinted ambient background: fixed radial-gradient, transparent for
    summary, lens-colored tint for the four lenses, 600ms transition.
  - Renders `UnifiedHeader`, lens-keyed body wrapped in `fade-up` (cross-fade on
    lens change), `LensDock`.
  - Smooth scroll-to-top of `.main` on lens change.

- **Summary sub-components** (all in this file):
  - `UnifiedHeader` — sticky, glass, competitor identity + scan metadata + range
    chips + Compare/Export/Full-data buttons. Eyebrow shifts color + glyph with
    active lens.
  - `ExecutiveSummary` — default body: `PerceptionHero`, executive memo, 2×2
    `LensPreviewCard` grid, 3 `AnchorQuote`s, 5-stat strip.
  - `PerceptionHero` — sentiment ring + 4 lens score tiles, crosshair background.
  - `PerceptionRing` — SVG donut, negative/neutral/positive arcs.
  - `LensPreviewCard` — clickable lens card with color stripe, score, insight,
    stats, hover lift; click switches to that lens.
  - `AnchorQuote` — themed quote card.
  - `SummaryStat` — single stat in the strip.
  - `LensDock` — fixed bottom-center dark glass pill, 5 segments; active segment
    takes lens color.
  - `LENS_META`, `LENS_HIGHLIGHTS` — static config objects ported from bundle.

### Modified files: the four lens routes

`founder.tsx`, `product.tsx`, `marketing.tsx`, `growth.tsx`:

- Add optional `embedded?: boolean` prop to each `*Page` component.
- When `embedded` is true: skip the view's own sticky header **and** its range
  chips (the unified header in v2 supplies both). Everything else — all sections,
  no data hidden — still renders.
- When `embedded` is absent/false: behaves exactly as today (standalone route).
- `ScanReportPage` renders `<FounderPage embedded />` etc. for the lens bodies.

### Routing — `app.tsx`

- Add `{ path: "scan-report", Component: ScanReportPage }` to the child routes.
- The four lens routes (`/founder /product /marketing /growth`) stay registered
  and URL-reachable — only removed from the sidebar.

### Navigation — `app-shell.tsx`

- Remove the four lens entries from the sidebar `NAV` array.
- Remove their breadcrumb-map entries; add a `/scan-report` crumb.
- Sidebar **Recent scans** items link to `/scan-report` instead of
  `/reports/:id`.
- Dashboard scan rows route to `/scan-report` (only if the dashboard already has
  scan-row links; otherwise no change).
- No new sidebar item is added — v2 is reached via Recent scans and dashboard
  rows.

## Lens system

| Lens      | Color     | Glyph |
|-----------|-----------|-------|
| Summary   | `#161412` | ◇     |
| Founder   | `#ff5c1a` | ⊙     |
| Product   | `#6366f1` | ⊞     |
| Marketing | `#8b5cf6` | ❝     |
| Growth    | `#16a34a` | ↗     |

- **Summary** is the default, neutral, calm view.
- **Lens commit**: clicking a dock segment or a preview card tints the page with
  the lens accent (radial ambient glow), cross-fades the content, shifts the
  header eyebrow to the lens color + glyph, and smooth-scrolls to top.
- **No data hidden**: each lens shows everything that view shows today.

## Styling

`packages/web/src/styles/globals.css` already contains the full design system
from earlier ports — `crosshair-bg`, `fade-up`, `.eyebrow`, `.card`, `.chip`,
`.h1`, `.h2`, `.btn`, mono utilities, and all `--*` CSS variables. **No CSS
changes are required.**

The four existing lens files already use raw hex / `rgba()` inline styles — a
pre-existing committed pattern from prior design-bundle ports. `scan-report.tsx`
follows the same inline-style pattern for visual consistency with its sibling
lens files. (This intentionally diverges from the web `CLAUDE.md` "tokens only"
rule, matching the already-merged lens files rather than introducing a third
style.)

## Out of scope

- No backend, no API calls, no data-pipeline changes.
- No changes to `report.tsx`, `scan.tsx`, `thread-modal`.
- `onOpenThread` / `onOpenQuote` callbacks are stubbed (no-op) — wired during a
  later integration pass.
- Mock data only.

## Verification

- `pnpm --filter @rivaleye/web type-check` passes.
- `pnpm --filter @rivaleye/web lint` passes.
- `pnpm --filter @rivaleye/web build` passes.
- `/scan-report` renders: summary by default, dock switches lenses, ambient tint
  + cross-fade animate, each lens body renders embedded (no doubled header).
- `/founder`, `/product`, `/marketing`, `/growth` still render standalone by URL.
- Sidebar no longer shows the four lens entries.
