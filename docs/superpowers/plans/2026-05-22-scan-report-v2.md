# Scan Report v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified `/scan-report` route that exposes the existing Founder/Product/Marketing/Growth views as in-place lenses plus a neutral Summary lens, and remove the four lens entries from the sidebar.

**Architecture:** New `scan-report.tsx` route holds self-contained mock data, a sticky lens-aware header, a default Executive Summary, and a floating lens dock. The four existing lens `*Page` components gain an optional `embedded` prop that suppresses their own header/range chips so they render as lens bodies inside the new report. Old `/scan` and `/reports/:id` routes and files are untouched.

**Tech Stack:** Vite + React 18 + TypeScript (strict), react-router-dom v6. Styling via the design-system classes already in `globals.css` plus inline styles (matching the existing lens files). No test runner is configured in `@rivaleye/web`; verification is type-check + lint + build.

---

## File Structure

- **Create:** `packages/web/src/routes/scan-report.tsx` — `ScanReportPage` + all summary sub-components + `SCAN_DATA` mock.
- **Modify:** `packages/web/src/routes/founder.tsx` — add `embedded?` prop to `FounderPage`.
- **Modify:** `packages/web/src/routes/product.tsx` — add `embedded?` prop to `ProductPage`.
- **Modify:** `packages/web/src/routes/marketing.tsx` — add `embedded?` prop to `MarketingPage`.
- **Modify:** `packages/web/src/routes/growth.tsx` — add `embedded?` prop to `GrowthPage`.
- **Modify:** `packages/web/src/app.tsx` — register `/scan-report` route.
- **Modify:** `packages/web/src/components/layout/app-shell.tsx` — drop 4 lens nav items, update crumbs, point Recent scans at `/scan-report`.

No test runner exists in `@rivaleye/web` (verified: `package.json` has no `test` script). Verification per task is `type-check` + `lint`. Final build at the end.

---

## Task 1: Add `embedded` prop to FounderPage

**Files:**
- Modify: `packages/web/src/routes/founder.tsx:310-321`

- [ ] **Step 1: Change the FounderPage signature and conditionally skip the header**

Find (`founder.tsx`, starting line 310):

```tsx
export function FounderPage() {
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState<Insight | null>(null);
  const [range, setRange] = useState("90d");

  const F = FOUNDER_DATA;
  const openEvidence = (insight: Insight) => setDrawer(insight);

  return (
    <div>
      <FounderHeader competitor={COMPETITOR} range={range} setRange={setRange} />
```

Replace with:

```tsx
export function FounderPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState<Insight | null>(null);
  const [range, setRange] = useState("90d");

  const F = FOUNDER_DATA;
  const openEvidence = (insight: Insight) => setDrawer(insight);

  return (
    <div>
      {!embedded && (
        <FounderHeader competitor={COMPETITOR} range={range} setRange={setRange} />
      )}
```

- [ ] **Step 2: Verify type-check passes**

Run: `pnpm --filter @rivaleye/web type-check`
Expected: PASS (no errors). `range`/`setRange` are still used by `FounderHeader` in the standalone path, so no unused-var error.

- [ ] **Step 3: Verify lint passes**

Run: `pnpm --filter @rivaleye/web lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/routes/founder.tsx
git commit -m "feat(web): add embedded prop to FounderPage"
```

---

## Task 2: Add `embedded` prop to ProductPage

**Files:**
- Modify: `packages/web/src/routes/product.tsx:648-659`

- [ ] **Step 1: Change the ProductPage signature and conditionally skip the header**

Find (`product.tsx`, starting line 648):

```tsx
export function ProductPage() {
```

That line plus the body down to the header render. The header is rendered at line 659:

```tsx
      <ProductHeader competitor={COMPETITOR} range={range} setRange={setRange} />
```

Apply two edits.

Edit A — change the signature. Replace:

```tsx
export function ProductPage() {
```

with:

```tsx
export function ProductPage({ embedded = false }: { embedded?: boolean }) {
```

Edit B — wrap the header render. Replace:

```tsx
      <ProductHeader competitor={COMPETITOR} range={range} setRange={setRange} />
```

with:

```tsx
      {!embedded && (
        <ProductHeader competitor={COMPETITOR} range={range} setRange={setRange} />
      )}
```

- [ ] **Step 2: Verify type-check passes**

Run: `pnpm --filter @rivaleye/web type-check`
Expected: PASS.

- [ ] **Step 3: Verify lint passes**

Run: `pnpm --filter @rivaleye/web lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/routes/product.tsx
git commit -m "feat(web): add embedded prop to ProductPage"
```

---

## Task 3: Add `embedded` prop to MarketingPage

**Files:**
- Modify: `packages/web/src/routes/marketing.tsx:577-589`

- [ ] **Step 1: Change the MarketingPage signature and conditionally skip the header**

Edit A — replace:

```tsx
export function MarketingPage() {
```

with:

```tsx
export function MarketingPage({ embedded = false }: { embedded?: boolean }) {
```

Edit B — replace (`marketing.tsx` line 589):

```tsx
      <MarketingHeader competitor={COMPETITOR} range={range} setRange={setRange} />
```

with:

```tsx
      {!embedded && (
        <MarketingHeader competitor={COMPETITOR} range={range} setRange={setRange} />
      )}
```

- [ ] **Step 2: Verify type-check passes**

Run: `pnpm --filter @rivaleye/web type-check`
Expected: PASS.

- [ ] **Step 3: Verify lint passes**

Run: `pnpm --filter @rivaleye/web lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/routes/marketing.tsx
git commit -m "feat(web): add embedded prop to MarketingPage"
```

---

## Task 4: Add `embedded` prop to GrowthPage

**Files:**
- Modify: `packages/web/src/routes/growth.tsx:545-563`

- [ ] **Step 1: Change the GrowthPage signature and conditionally skip the header**

Edit A — replace:

```tsx
export function GrowthPage() {
```

with:

```tsx
export function GrowthPage({ embedded = false }: { embedded?: boolean }) {
```

Edit B — replace (`growth.tsx` line 563):

```tsx
      <GrowthHeader competitor={COMPETITOR} range={range} setRange={setRange} />
```

with:

```tsx
      {!embedded && (
        <GrowthHeader competitor={COMPETITOR} range={range} setRange={setRange} />
      )}
```

- [ ] **Step 2: Verify type-check passes**

Run: `pnpm --filter @rivaleye/web type-check`
Expected: PASS.

- [ ] **Step 3: Verify lint passes**

Run: `pnpm --filter @rivaleye/web lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/routes/growth.tsx
git commit -m "feat(web): add embedded prop to GrowthPage"
```

---

## Task 5: Create the scan-report.tsx route file

**Files:**
- Create: `packages/web/src/routes/scan-report.tsx`

- [ ] **Step 1: Write the full scan-report.tsx file**

Create `packages/web/src/routes/scan-report.tsx` with exactly this content:

```tsx
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/icons";
import { FounderPage } from "./founder";
import { ProductPage } from "./product";
import { MarketingPage } from "./marketing";
import { GrowthPage } from "./growth";

// Scan Report v2 — one scan, five lenses. UI only.
// TODO(backend): replace SCAN_DATA with the scan-synthesis endpoint payload.

type LensId = "summary" | "founder" | "product" | "marketing" | "growth";

interface LensMeta {
  name: string;
  color: string;
  bg: string;
  glyph: string;
  role: string;
}

const LENS_META: Record<LensId, LensMeta> = {
  summary:   { name: "Summary",   color: "#161412", bg: "rgba(20,16,12,0.05)",   glyph: "◇", role: "Executive memo · neutral" },
  founder:   { name: "Founder",   color: "#ff5c1a", bg: "rgba(255,92,26,0.10)",  glyph: "⊙", role: "Market opening · wedge to attack" },
  product:   { name: "Product",   color: "#6366f1", bg: "rgba(99,102,241,0.10)", glyph: "⊞", role: "Roadmap intelligence · gaps & evidence" },
  marketing: { name: "Marketing", color: "#8b5cf6", bg: "rgba(139,92,246,0.10)", glyph: "❝", role: "Positioning · copy · angles" },
  growth:    { name: "Growth",    color: "#16a34a", bg: "rgba(22,163,74,0.10)",  glyph: "↗", role: "Switch intent · live conversations" },
};

interface LensHighlight {
  score: number;
  scoreLabel: string;
  insight: string;
  stats: { k: string; v: string }[];
}

const LENS_HIGHLIGHTS: Record<Exclude<LensId, "summary">, LensHighlight> = {
  founder: {
    score: 82, scoreLabel: "Strong opportunity",
    insight: "Best wedge: The project tool that doesn't punish you for growing.",
    stats: [
      { k: "Wedge confidence", v: "92%" },
      { k: "Risks flagged",    v: "4"   },
      { k: "Action moves",     v: "3"   },
    ],
  },
  product: {
    score: 78, scoreLabel: "Strong roadmap opportunity",
    insight: "Top gap: Native time tracking — 412 mentions, agency wedge wide open.",
    stats: [
      { k: "Feature gaps",     v: "8" },
      { k: "Build candidates", v: "4" },
      { k: "Roadmap items",    v: "5" },
    ],
  },
  marketing: {
    score: 86, scoreLabel: "Strong messaging opportunity",
    insight: "Best angle: “All the speed. None of the seat tax.”",
    stats: [
      { k: "Angles",        v: "6"   },
      { k: "Copy ideas",    v: "17"  },
      { k: "Quote library", v: "10+" },
    ],
  },
  growth: {
    score: 79, scoreLabel: "Strong intent signal",
    insight: "Hottest: r/SaaS cancellation thread — 1.4k upvotes, still on the front page.",
    stats: [
      { k: "Hot threads",     v: "3" },
      { k: "Communities",     v: "7" },
      { k: "Reply templates", v: "3" },
    ],
  },
};

interface ScanQuote {
  who: string;
  sub: string;
  when: string;
  score: number;
  sentiment: number;
  text: string;
}

interface ScanCompetitor {
  name: string;
  domain: string;
  scannedAt: string;
  sources: number;
  platforms: { id: string; name: string }[];
  sentiment: {
    overall: number;
    positive: number;
    neutral: number;
    negative: number;
    trend: string;
  };
}

interface ScanData {
  competitor: ScanCompetitor;
  quotes: ScanQuote[];
}

const SCAN_DATA: ScanData = {
  competitor: {
    name: "Linear",
    domain: "linear.app",
    scannedAt: "2026-05-12 14:22 UTC",
    sources: 1247,
    platforms: [
      { id: "reddit",      name: "Reddit" },
      { id: "g2",          name: "G2 reviews" },
      { id: "linkedin",    name: "LinkedIn" },
      { id: "producthunt", name: "Product Hunt" },
      { id: "twitter",     name: "X / Twitter" },
      { id: "youtube",     name: "YouTube" },
      { id: "hn",          name: "Hacker News" },
    ],
    sentiment: {
      overall: -0.34,
      positive: 0.28,
      neutral: 0.31,
      negative: 0.41,
      trend: "+0.08 vs prev 90d",
    },
  },
  quotes: [
    { who: "u/devops_dan",      sub: "r/sysadmin",          when: "3d", score: 412, sentiment: -0.71,
      text: "If Linear shipped a real audit log I'd renew tomorrow. Without it our security review is a nightmare." },
    { who: "u/pm_mariana",      sub: "r/ProductManagement", when: "5d", score: 287, sentiment: -0.55,
      text: "Cycles are great. Why is there no concept of 'this depends on that' in 2026? I'm building dependency maps in FigJam." },
    { who: "u/startup_charlie", sub: "r/startups",          when: "1w", score: 198, sentiment: -0.34,
      text: "Bought Linear for the speed. Stayed for the speed. Annoyed by the price every time we grow." },
    { who: "u/contractor_v",    sub: "r/ExperiencedDevs",   when: "1w", score: 174, sentiment: -0.62,
      text: "I bill by the hour. My time tracking lives in Toggl. My work lives in Linear. They will never speak." },
    { who: "u/founder_h",       sub: "r/SaaS",              when: "2w", score: 138, sentiment: -0.39,
      text: "Customers ask for our public roadmap. We post one on Notion and try to keep it in sync. We always fail." },
  ],
};

// ----------------------------------------------------------------------------

export function ScanReportPage() {
  const navigate = useNavigate();
  const [lens, setLens] = useState<LensId>("summary");
  const [range, setRange] = useState("90d");
  const meta = LENS_META[lens];

  useEffect(() => {
    const m = document.querySelector(".main");
    if (m) m.scrollTo({ top: 0, behavior: "smooth" });
  }, [lens]);

  const onNav = (to: string) => navigate(to.startsWith("/") ? to : `/${to}`);

  return (
    <div style={{ position: "relative", minHeight: "100%" }}>
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
          background: lens === "summary"
            ? "transparent"
            : `radial-gradient(ellipse 1200px 600px at 50% -10%, ${meta.bg} 0%, transparent 60%)`,
          transition: "background 600ms cubic-bezier(.2,.7,.2,1)",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <UnifiedHeader
          competitor={SCAN_DATA.competitor}
          lens={lens}
          meta={meta}
          range={range}
          setRange={setRange}
          onNav={onNav}
        />

        <div key={lens} className="fade-up">
          {lens === "summary"   && <ExecutiveSummary data={SCAN_DATA} onPickLens={setLens} />}
          {lens === "founder"   && <FounderPage embedded />}
          {lens === "product"   && <ProductPage embedded />}
          {lens === "marketing" && <MarketingPage embedded />}
          {lens === "growth"    && <GrowthPage embedded />}
        </div>

        <div style={{ height: 110 }} />
      </div>

      <LensDock active={lens} onPick={setLens} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// UNIFIED HEADER

interface UnifiedHeaderProps {
  competitor: ScanCompetitor;
  lens: LensId;
  meta: LensMeta;
  range: string;
  setRange: (r: string) => void;
  onNav: (to: string) => void;
}

function UnifiedHeader({ competitor: c, meta, range, setRange, onNav }: UnifiedHeaderProps) {
  return (
    <div
      style={{
        padding: "18px 28px 14px",
        borderBottom: "1px solid var(--border)",
        background: "var(--glass)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        position: "sticky", top: 0, zIndex: 4,
        transition: "border-color 400ms",
      }}
    >
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 52, height: 52, borderRadius: 12,
                background: "#5e6ad2", color: "#fff",
                display: "grid", placeItems: "center",
                fontSize: 22, fontWeight: 600,
                fontFamily: "var(--font-mono)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              L
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="eyebrow" style={{ fontSize: 10 }}>SCAN REPORT</span>
                <span className="mono faint" style={{ fontSize: 10 }}>·</span>
                <span
                  className="mono"
                  style={{
                    fontSize: 10, fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.08em",
                    color: meta.color, transition: "color 400ms",
                  }}
                >
                  {meta.glyph} {meta.name} lens
                </span>
              </div>
              <h1 className="h1" style={{ fontSize: 24, marginTop: 4, display: "flex", alignItems: "center", gap: 10 }}>
                {c.name}
                <span className="mono faint" style={{ fontSize: 12, fontWeight: 400 }}>{c.domain}</span>
                <span className="chip pos" style={{ fontSize: 9 }}>FRESH</span>
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                <span className="mono faint" style={{ fontSize: 11 }}>SCANNED {c.scannedAt}</span>
                <span className="mono faint" style={{ fontSize: 11 }}>·</span>
                <span className="mono faint" style={{ fontSize: 11 }}>
                  {c.sources.toLocaleString()} mentions · {c.platforms.length} platforms
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="mono faint" style={{ fontSize: 11, marginRight: 4 }}>RANGE</span>
            {["30d", "90d", "1y", "all"].map((r) => (
              <button
                key={r}
                className={`chip ${range === r ? "solid" : ""}`}
                style={{ cursor: "pointer", padding: "3px 10px" }}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
            <div style={{ width: 1, height: 18, background: "var(--border)", margin: "0 6px" }} />
            <button className="btn ghost sm" onClick={() => onNav("/compare")}>
              <Icon name="compare" size={14} /> Compare
            </button>
            <button className="btn ghost sm">
              <Icon name="download" size={14} /> Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// EXECUTIVE SUMMARY

function ExecutiveSummary({ data, onPickLens }: { data: ScanData; onPickLens: (id: LensId) => void }) {
  const c = data.competitor;
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 28px 0" }}>
      <PerceptionHero data={data} />

      <div style={{ marginTop: 28 }}>
        <div className="eyebrow" style={{ fontSize: 10 }}>EXECUTIVE MEMO</div>
        <h2 className="h2" style={{ fontSize: 28, marginTop: 8, letterSpacing: "-0.02em", lineHeight: 1.2, maxWidth: 920 }}>
          {c.name}'s pain is structural, not stylistic — and pricing is the wedge users are already naming for you.
        </h2>
        <p style={{ marginTop: 14, fontSize: 16, lineHeight: 1.65, color: "var(--fg-muted)", maxWidth: 920 }}>
          Across {c.sources.toLocaleString()} mentions in the last 90 days, three themes own 60% of negative sentiment:
          per-seat <b style={{ color: "var(--fg)" }}>pricing past 15 seats</b> (187 mentions, +34%),
          the absence of <b style={{ color: "var(--fg)" }}>native time tracking</b> (152, +18%),
          and a <b style={{ color: "var(--fg)" }}>mobile app described as "read-mostly"</b> (134, +9%).
          Net switching is strongly inbound (+325 from Jira, Asana, ClickUp), but outbound mentions cite the same
          pricing argument and a growing demand for executive roadmap views.
        </p>
        <p style={{ marginTop: 12, fontSize: 16, lineHeight: 1.65, color: "var(--fg-muted)", maxWidth: 920 }}>
          Switch a lens below to read the same evidence through a specific role — founder strategy, product
          roadmap, marketing copy, or growth conversations.
        </p>
      </div>

      <div style={{ marginTop: 28 }}>
        <div className="eyebrow" style={{ fontSize: 10, marginBottom: 14 }}>PICK A LENS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {(["founder", "product", "marketing", "growth"] as const).map((id) => (
            <LensPreviewCard key={id} id={id} onPick={onPickLens} />
          ))}
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div className="eyebrow" style={{ fontSize: 10 }}>THE THREE QUOTES THAT SAY IT ALL</div>
            <h3 className="h2" style={{ fontSize: 18, marginTop: 6 }}>Top of mind, top of thread</h3>
          </div>
          <span className="mono faint" style={{ fontSize: 11 }}>cross-cutting · all lenses anchor here</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <AnchorQuote q={data.quotes[2]} theme="Pricing" color="#ff5c1a" />
          <AnchorQuote q={data.quotes[3]} theme="Time tracking" color="#6366f1" />
          <AnchorQuote q={data.quotes[1]} theme="Roadmap" color="#8b5cf6" />
        </div>
      </div>

      <div
        style={{
          marginTop: 32, padding: "22px 24px",
          background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--border)",
          display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 24,
        }}
      >
        <SummaryStat label="Sentiment index" value={c.sentiment.overall.toFixed(2)} tone="neg" sub={c.sentiment.trend} />
        <SummaryStat label="Mentions" value={c.sources.toLocaleString()} sub="+18% vs prev" />
        <SummaryStat label="Platforms" value={String(c.platforms.length)} sub="all active" />
        <SummaryStat label="Switching net" value="+325" tone="pos" sub="inbound · 90d" />
        <SummaryStat label="Top theme" value="Pricing" tone="warn" sub="187 · +34%" />
      </div>
    </div>
  );
}

function SummaryStat({ label, value, tone, sub }: { label: string; value: string; tone?: "neg" | "pos" | "warn"; sub: string }) {
  const color =
    tone === "neg" ? "var(--neg)" : tone === "pos" ? "var(--pos)" : tone === "warn" ? "var(--warn)" : "var(--fg)";
  return (
    <div>
      <div className="eyebrow" style={{ fontSize: 10 }}>{label}</div>
      <div className="mono tnum" style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", marginTop: 4, color }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// PERCEPTION HERO

function PerceptionHero({ data }: { data: ScanData }) {
  const s = data.competitor.sentiment;
  return (
    <div className="card elev" style={{ overflow: "hidden", position: "relative" }}>
      <div className="crosshair-bg" style={{ position: "absolute", inset: 0, opacity: 0.4 }} />
      <div
        style={{
          position: "relative", padding: 24,
          display: "grid", gridTemplateColumns: "auto 1fr", gap: 28, alignItems: "center",
        }}
      >
        <PerceptionRing positive={s.positive} neutral={s.neutral} negative={s.negative} index={s.overall} />

        <div style={{ minWidth: 0 }}>
          <div className="eyebrow" style={{ fontSize: 10 }}>
            WHAT USERS THINK OF {data.competitor.name.toUpperCase()}
          </div>
          <h2 className="h2" style={{ fontSize: 26, marginTop: 6, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            Negative-leaning, with the loudest theme being <span style={{ color: "var(--accent)" }}>pricing</span>.
          </h2>

          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {(["founder", "product", "marketing", "growth"] as const).map((id) => {
              const m = LENS_META[id];
              const h = LENS_HIGHLIGHTS[id];
              return (
                <div
                  key={id}
                  style={{
                    padding: "12px 14px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-md)",
                    background: "var(--surface-solid)",
                    borderTop: `2px solid ${m.color}`,
                  }}
                >
                  <div
                    className="mono"
                    style={{ fontSize: 9, color: m.color, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}
                  >
                    {m.glyph} {m.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                    <span
                      className="mono tnum"
                      style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", color: m.color }}
                    >
                      {h.score}
                    </span>
                    <span className="mono faint" style={{ fontSize: 11 }}>/100</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function PerceptionRing({ positive, neutral, negative, index }: { positive: number; neutral: number; negative: number; index: number }) {
  const r = 76;
  const circ = 2 * Math.PI * r;
  const negLen = negative * circ;
  const neuLen = neutral * circ;
  const posLen = positive * circ;

  return (
    <div style={{ position: "relative", width: 200, height: 200 }}>
      <svg width="200" height="200" viewBox="0 0 200 200" style={{ display: "block", transform: "rotate(-90deg)" }}>
        <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(20,16,12,0.06)" strokeWidth="16" />
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--neg)" strokeWidth="16"
          strokeDasharray={`${negLen} ${circ}`} strokeDashoffset={0} strokeLinecap="butt" />
        <circle cx="100" cy="100" r={r} fill="none" stroke="#d1ccc2" strokeWidth="16"
          strokeDasharray={`${neuLen} ${circ}`} strokeDashoffset={-negLen} strokeLinecap="butt" />
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--pos)" strokeWidth="16"
          strokeDasharray={`${posLen} ${circ}`} strokeDashoffset={-(negLen + neuLen)} strokeLinecap="butt" />
      </svg>
      <div
        style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}
      >
        <div className="mono faint" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          PERCEPTION
        </div>
        <div
          className="mono tnum"
          style={{ fontSize: 36, fontWeight: 500, letterSpacing: "-0.03em", marginTop: 2, color: "var(--neg)" }}
        >
          {index.toFixed(2)}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 9 }}>
          <span style={{ color: "var(--pos)" }}>+{Math.round(positive * 100)}</span>
          <span className="faint">·</span>
          <span className="faint">{Math.round(neutral * 100)}</span>
          <span className="faint">·</span>
          <span style={{ color: "var(--neg)" }}>−{Math.round(negative * 100)}</span>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// LENS PREVIEW CARD

function LensPreviewCard({ id, onPick }: { id: Exclude<LensId, "summary">; onPick: (id: LensId) => void }) {
  const m = LENS_META[id];
  const h = LENS_HIGHLIGHTS[id];
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={() => onPick(id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: `1px solid ${hover ? m.color + "55" : "var(--border)"}`,
        borderRadius: "var(--r-lg)",
        background: hover ? `linear-gradient(135deg, ${m.bg}, transparent 70%)` : "var(--surface)",
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
        overflow: "hidden",
        transition: "border-color 200ms, background 200ms, transform 200ms",
        transform: hover ? "translateY(-1px)" : "translateY(0)",
        boxShadow: hover ? `0 12px 32px ${m.bg}` : "var(--shadow-sm)",
        position: "relative",
      }}
    >
      <div style={{ height: 3, background: m.color }} />

      <div style={{ padding: 22, display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "flex-start" }}>
        <div>
          <div
            className="mono"
            style={{ fontSize: 10, color: m.color, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}
          >
            {m.glyph} {m.name.toUpperCase()} LENS
          </div>
          <h3 className="h2" style={{ fontSize: 19, marginTop: 6, letterSpacing: "-0.015em", lineHeight: 1.3 }}>
            {h.insight}
          </h3>
          <div className="muted" style={{ marginTop: 4, fontSize: 12.5 }}>{m.role}</div>

          <div style={{ marginTop: 16, display: "flex", gap: 14, flexWrap: "wrap" }}>
            {h.stats.map((s) => (
              <div key={s.k}>
                <div
                  className="mono"
                  style={{ fontSize: 16, fontWeight: 600, color: m.color, fontVariantNumeric: "tabular-nums" }}
                >
                  {s.v}
                </div>
                <div
                  className="mono faint"
                  style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}
                >
                  {s.k}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 14 }}>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontFamily: "var(--font-mono)", fontSize: 44, fontWeight: 500,
                letterSpacing: "-0.04em", color: m.color, lineHeight: 0.95,
              }}
            >
              {h.score}
            </div>
            <div className="mono faint" style={{ fontSize: 10, marginTop: 2 }}>/100</div>
          </div>
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px",
              background: hover ? m.color : "var(--surface-solid)",
              color: hover ? "#fff" : m.color,
              border: `1px solid ${hover ? m.color : m.color + "55"}`,
              borderRadius: 99,
              fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
              letterSpacing: "0.04em",
              transition: "all 200ms",
            }}
          >
            Enter {m.name} <Icon name="arrow-right" size={11} />
          </span>
        </div>
      </div>
    </button>
  );
}

// ----------------------------------------------------------------------------
// ANCHOR QUOTE

function AnchorQuote({ q, theme, color }: { q: ScanQuote; theme: string; color: string }) {
  return (
    <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, borderTop: `2px solid ${color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          className="mono"
          style={{ fontSize: 10, color, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}
        >
          THEME · {theme.toUpperCase()}
        </span>
        <span className="mono tnum faint" style={{ fontSize: 11 }}>{q.score}↑</span>
      </div>
      <p style={{ margin: 0, fontSize: 15, fontStyle: "italic", lineHeight: 1.55, color: "var(--fg)" }}>
        "{q.text}"
      </p>
      <div className="mono faint" style={{ fontSize: 11 }}>
        {q.who} · {q.sub} · {q.when}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// LENS DOCK

function LensDock({ active, onPick }: { active: LensId; onPick: (id: LensId) => void }) {
  const order: LensId[] = ["summary", "founder", "product", "marketing", "growth"];
  const [hovered, setHovered] = useState<LensId | null>(null);

  return (
    <div
      style={{
        position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)",
        zIndex: 40,
        padding: 5,
        background: "rgba(20,16,12,0.86)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 99,
        boxShadow: "0 24px 60px rgba(0,0,0,0.30), 0 4px 12px rgba(0,0,0,0.20), 0 0 0 1px rgba(255,255,255,0.04) inset",
        display: "flex", gap: 2, alignItems: "center",
      }}
    >
      {order.map((id) => {
        const m = LENS_META[id];
        const isActive = active === id;
        const isHov = hovered === id;
        return (
          <button
            key={id}
            onClick={() => onPick(id)}
            onMouseEnter={() => setHovered(id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              border: 0,
              padding: "8px 14px",
              borderRadius: 99,
              cursor: "pointer",
              background: isActive ? m.color : isHov ? "rgba(255,255,255,0.08)" : "transparent",
              color: isActive ? "#fff" : "rgba(255,255,255,0.78)",
              display: "inline-flex", alignItems: "center", gap: 8,
              fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
              letterSpacing: "0.02em",
              transition: "background 200ms, color 200ms, transform 120ms",
              transform: isActive ? "scale(1.0)" : "scale(0.98)",
            }}
          >
            <span
              style={{
                width: 6, height: 6, borderRadius: 99,
                background: isActive ? "#fff" : m.color,
                boxShadow: isActive ? "0 0 0 3px rgba(255,255,255,0.15)" : "none",
                transition: "box-shadow 200ms",
              }}
            />
            {m.name}
            {isActive && id !== "summary" && (
              <span style={{ fontSize: 9, opacity: 0.8, marginLeft: -3, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                LENS
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

Notes for the implementer:
- The `\uXXXX` escapes above are placeholders for non-ASCII glyphs. Write them as the actual literal characters in the file: `◇`=◇, `⊙`=⊙, `⊞`=⊞, `❝`=❝, `↗`=↗, `·`=·, `❝`/`“`=❝/", `”`=", `—`=—, `↑`=↑, `−`=−.
- `CSSProperties` is imported but the file may not need it directly; if `pnpm lint` flags it as unused, remove the `, type CSSProperties` from the import. (See Step 2.)

- [ ] **Step 2: Verify type-check passes**

Run: `pnpm --filter @rivaleye/web type-check`
Expected: PASS. If it fails on an unused `CSSProperties` import, edit the first import line to drop `, type CSSProperties`, then re-run.

- [ ] **Step 3: Verify lint passes**

Run: `pnpm --filter @rivaleye/web lint`
Expected: PASS. Fix any unused-import warning the same way as Step 2.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/routes/scan-report.tsx
git commit -m "feat(web): add unified Scan Report v2 route component"
```

---

## Task 6: Register the /scan-report route

**Files:**
- Modify: `packages/web/src/app.tsx:14` (imports) and `app.tsx:60` (route table)

- [ ] **Step 1: Add the import**

Find:

```tsx
import { ReportPage } from "./routes/report";
```

Replace with:

```tsx
import { ReportPage } from "./routes/report";
import { ScanReportPage } from "./routes/scan-report";
```

- [ ] **Step 2: Register the route**

Find:

```tsx
      { path: "reports/:id", Component: ReportPage },
```

Replace with:

```tsx
      { path: "reports/:id", Component: ReportPage },
      { path: "scan-report", Component: ScanReportPage },
```

- [ ] **Step 3: Verify type-check passes**

Run: `pnpm --filter @rivaleye/web type-check`
Expected: PASS.

- [ ] **Step 4: Verify lint passes**

Run: `pnpm --filter @rivaleye/web lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/app.tsx
git commit -m "feat(web): register /scan-report route"
```

---

## Task 7: Remove lens entries from the sidebar and point Recent scans at /scan-report

**Files:**
- Modify: `packages/web/src/components/layout/app-shell.tsx` — crumb map (~line 16-27), `NAV` array (~line 152-157), Recent scans link (~line 221)

- [ ] **Step 1: Read the relevant sections**

Run: `sed -n '12,30p;148,160p;205,245p' packages/web/src/components/layout/app-shell.tsx`
This shows the crumb map, the `NAV` array, and the Recent scans render. Use the exact current text for the edits below.

- [ ] **Step 2: Remove the four lens crumb entries**

In the crumb map object, delete these four lines:

```tsx
  "/founder": ["Stitchworks", "Founder View"],
  "/product": ["Stitchworks", "Product View"],
  "/marketing": ["Stitchworks", "Marketing View"],
  "/growth": ["Stitchworks", "Growth View"],
```

Add this line in their place (same object):

```tsx
  "/scan-report": ["Stitchworks", "Scan Report"],
```

- [ ] **Step 3: Remove the four lens NAV items**

In the `NAV` array, delete these four lines:

```tsx
  { to: "/founder",     icon: "spark",   label: "Founder View" },
  { to: "/product",     icon: "list",    label: "Product View" },
  { to: "/marketing",   icon: "quote",   label: "Marketing View" },
  { to: "/growth",      icon: "trend-up", label: "Growth View" },
```

Leave the rest of `NAV` (including the `/scan` "New scan" item) unchanged. Do not add a `/scan-report` nav item — per the design it is reached via Recent scans, not the sidebar.

- [ ] **Step 4: Point Recent scans at /scan-report**

Find the Recent scans link (around line 221):

```tsx
            to={`/reports/${r.id}`}
```

Replace with:

```tsx
            to="/scan-report"
```

If `r.id` becomes unused after this change and lint/type-check flags it, that is addressed in Step 5 — but `r` is still used for `relativeTime(r.scanned_at ?? r.created_at)` and the label, so only the `r.id` reference is removed and no variable becomes unused.

- [ ] **Step 5: Verify type-check passes**

Run: `pnpm --filter @rivaleye/web type-check`
Expected: PASS.

- [ ] **Step 6: Verify lint passes**

Run: `pnpm --filter @rivaleye/web lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/components/layout/app-shell.tsx
git commit -m "feat(web): drop lens nav items, route Recent scans to /scan-report"
```

---

## Task 8: Route dashboard scan rows to /scan-report

**Files:**
- Modify: `packages/web/src/routes/dashboard.tsx` (only if it has scan-row navigation)

- [ ] **Step 1: Check whether the dashboard navigates to reports**

Run: `grep -n "reports/\|/founder\|navigate\|onNav\|to=" packages/web/src/routes/dashboard.tsx`

- If there are links/navigation to `/reports/...` or `/founder` (the Linear row), proceed to Step 2.
- If there are none, skip to Step 4 (no change needed) and note "dashboard has no scan-row links" in the commit-skip.

- [ ] **Step 2: Repoint scan-row navigation**

For each navigation target found in Step 1 that opens a competitor/scan report (e.g. `navigate("/reports/" + id)` or `navigate("/founder")`), change the destination to `/scan-report`. Leave navigation to non-report destinations (account, radar, competitors, etc.) unchanged.

Example — if the file contains:

```tsx
onClick={() => navigate(`/reports/${row.id}`)}
```

change it to:

```tsx
onClick={() => navigate("/scan-report")}
```

- [ ] **Step 3: Verify type-check and lint pass**

Run: `pnpm --filter @rivaleye/web type-check && pnpm --filter @rivaleye/web lint`
Expected: PASS.

- [ ] **Step 4: Commit (only if Step 2 made changes)**

```bash
git add packages/web/src/routes/dashboard.tsx
git commit -m "feat(web): route dashboard scan rows to /scan-report"
```

If Step 1 found no scan-row links, make no commit for this task.

---

## Task 9: Full build verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full web build**

Run: `pnpm --filter @rivaleye/web build`
Expected: PASS — type-check + Vite build complete with no errors.

- [ ] **Step 2: Run the dev server and manually verify**

Run: `pnpm --filter @rivaleye/web dev`

Then in the browser:
- Navigate to `/scan-report`. Expected: Executive Summary renders by default — perception ring, 4 lens score tiles, executive memo, 2×2 lens preview cards, 3 anchor quotes, 5-stat strip. Lens dock visible bottom-center.
- Click each dock segment (Founder, Product, Marketing, Growth). Expected: ambient background tints to the lens color, content cross-fades, header eyebrow shows the lens glyph + name in the lens color, page scrolls to top. Each lens body renders with **no second header** (only the unified header at top).
- Click "Summary" in the dock. Expected: returns to Executive Summary, background tint clears.
- Click a `LensPreviewCard`. Expected: switches to that lens, same as the dock.
- Navigate directly to `/founder`, `/product`, `/marketing`, `/growth`. Expected: each still renders standalone **with** its own header (embedded prop defaults to false).
- Open the sidebar. Expected: no Founder/Product/Marketing/Growth entries. "New scan" still present.
- Click a Recent scans item in the sidebar. Expected: opens `/scan-report`.

- [ ] **Step 3: Stop the dev server**

Press `Ctrl+C` in the terminal running `pnpm dev`.

- [ ] **Step 4: Final commit (if any uncommitted fixes were made during verification)**

```bash
git status
# if there are uncommitted fixes:
git add -A
git commit -m "fix(web): scan-report verification fixes"
```

If `git status` is clean, no commit is needed — the feature is complete.

---

## Self-Review Notes

- **Spec coverage:** New `/scan-report` route (Task 5, 6) ✓. `embedded` prop on all 4 lenses (Tasks 1-4) ✓. Sidebar lens removal + crumbs + Recent scans repoint (Task 7) ✓. Dashboard rows (Task 8) ✓. Old `/scan`, `/reports/:id` untouched — no task modifies them ✓. Mock data self-contained in `scan-report.tsx` (Task 5) ✓. `globals.css` unchanged — design system already present ✓.
- **Verification:** No test runner in `@rivaleye/web`; verification is type-check + lint per task and a build + manual pass at the end (Task 9). This matches the spec's verification section.
- **Type consistency:** `ScanData` / `ScanCompetitor` / `ScanQuote` / `LensId` / `LensMeta` / `LensHighlight` defined once in Task 5 and used consistently. `embedded?: boolean` prop signature identical across Tasks 1-4.
- **`onOpenThread` / `onOpenQuote`:** the bundle's `ReportV2` accepted these callbacks; the embedded lens pages here use their own internal drawers (`EvidenceDrawer` etc.) and `useNavigate`, so no thread/quote callbacks are threaded — consistent with the spec's "stubbed / no-op" note.
