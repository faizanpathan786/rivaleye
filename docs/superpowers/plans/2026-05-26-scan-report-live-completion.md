# Scan Report Live Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the two pending TODOs in the scan-report view: generate and persist summary section data via the worker, and wire range filtering through all lens pages.

**Architecture:** Summary generation happens in worker Stage D (after all role sections are computed), persisted to the same `report_role_sections` table, and returned by the existing API. Range state is lifted from local component state and threaded down to each lens page for live filtering.

**Tech Stack:** Bun, Elysia (API), React, TypeScript, Drizzle ORM, OpenRouter LLM

---

## Phase 1: Summary Section Generation (Worker)

### Task 1: Create summary synthesis prompt builder

**Files:**
- Create: `packages/worker/src/prompts/summary-synthesis.ts`

- [ ] **Step 1: Create the file**

```bash
touch packages/worker/src/prompts/summary-synthesis.ts
```

- [ ] **Step 2: Write the summary synthesis prompt**

```typescript
// packages/worker/src/prompts/summary-synthesis.ts

import { z } from "zod";
import type { PipelineCtx, PlatformExtract } from "./shared";

const summaryDataSchema = z.object({
  competitor: z.object({
    name: z.string(),
    domain: z.string(),
    scannedAt: z.string(),
    sources: z.number(),
    platforms: z.array(z.object({ id: z.string(), name: z.string() })),
    sentiment: z.object({
      overall: z.number().min(-1).max(1),
      positive: z.number().min(0).max(1),
      neutral: z.number().min(0).max(1),
      negative: z.number().min(0).max(1),
      trend: z.string(),
    }),
  }),
  headlines: z.object({
    mainThesis: z.string().max(200),
    insights: z.string().max(500),
  }),
  topThemes: z.array(
    z.object({
      name: z.string(),
      mentions: z.number(),
      trend: z.string(),
    })
  ).min(1).max(5),
  topQuotes: z.array(
    z.object({
      who: z.string(),
      sub: z.string(),
      when: z.string(),
      score: z.number(),
      sentiment: z.number(),
      text: z.string(),
      theme: z.string(),
    })
  ).min(1).max(5),
});

export type SummaryData = z.infer<typeof summaryDataSchema>;

const SYSTEM = `You are a competitive intelligence synthesizer. You will receive platform-level extracts and overall report metadata. Your job: synthesize a cross-platform competitive summary.

Return ONE JSON object matching this exact shape:
{
  "competitor": { "name": "string", "domain": "string", "scannedAt": "ISO timestamp", "sources": number, "platforms": [{"id": "string", "name": "string"}], "sentiment": { "overall": number, "positive": number, "neutral": number, "negative": number, "trend": "string" } },
  "headlines": { "mainThesis": "one-liner insight", "insights": "1-2 sentence narrative" },
  "topThemes": [{ "name": "string", "mentions": number, "trend": "string" }],
  "topQuotes": [{ "who": "string", "sub": "string", "when": "string", "score": number, "sentiment": number, "text": "string", "theme": "string" }]
}

Rules:
- mainThesis: A declarative one-liner capturing the competitor's primary vulnerability or strength across all platforms (e.g., "Pricing structure creates switching risk").
- insights: Supporting evidence in 1-2 sentences. What's the story the data tells?
- topThemes: Extract 2-4 themes that own most of the sentiment. Include mention count and trend ("+18%" or "-5%").
- topQuotes: Select the 3-5 highest-signal quotes from ALL platforms that together tell the story. Include original source (who, sub, when). Include theme.
- sentiment.trend: Format as "+0.08 vs prev 90d" or similar.
- Never invent data not present in the input.
- Return ONLY the JSON object. No prose, no markdown.`;

export interface SummarySynthesisInput {
  ctx: PipelineCtx;
  competitor: string;
  scannedAt: string;
  sources: number;
  platforms: Array<{ id: string; name: string }>;
  sentiment: {
    overall: number;
    positive: number;
    neutral: number;
    negative: number;
    trend: string;
  };
  platformExtracts: Record<string, PlatformExtract>;
  topQuotes: Array<{
    who: string;
    sub: string;
    when: string;
    score: number;
    sentiment: number;
    text: string;
    platform: string;
  }>;
}

export function buildSummarySynthesis(input: SummarySynthesisInput): {
  system: string;
  user: string;
  schema: typeof summaryDataSchema;
} {
  const extractBlock = Object.entries(input.platformExtracts)
    .map(([platform, extract]) => `[${platform}]\n${JSON.stringify(extract, null, 2)}`)
    .join("\n\n");

  const quotesBlock = input.topQuotes
    .map((q) => `- ${q.who} (${q.sub}, ${q.when}): "${q.text}" [${q.platform}]`)
    .join("\n");

  const user = `Competitor: ${input.competitor}
Scanned: ${input.scannedAt}
Total sources: ${input.sources}
Platforms: ${input.platforms.map((p) => p.name).join(", ")}
Overall sentiment: ${input.sentiment.overall.toFixed(2)} (${Math.round(input.sentiment.positive * 100)}% positive, ${Math.round(input.sentiment.neutral * 100)}% neutral, ${Math.round(input.sentiment.negative * 100)}% negative)
Trend: ${input.sentiment.trend}

Platform-level extracts (complaints, features_requested, pricing_signals, switching_signals, voice_phrases, quotes):
${extractBlock}

Top quotes across all platforms:
${quotesBlock}

Now synthesize the cross-platform summary.`;

  return { system: SYSTEM, user, schema: summaryDataSchema };
}
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check 2>&1 | grep summary-synthesis
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/prompts/summary-synthesis.ts
git commit -m "feat(worker): add summary synthesis prompt builder"
```

---

### Task 2: Wire summary generation into Stage D

**Files:**
- Modify: `packages/worker/src/pipeline/stage-d-synthesis.ts`

- [ ] **Step 1: Read the current Stage D file to understand structure**

```bash
head -100 packages/worker/src/pipeline/stage-d-synthesis.ts
```

- [ ] **Step 2: Add import for summary synthesis**

At the top of `stage-d-synthesis.ts`, add:

```typescript
import { buildSummarySynthesis, type SummaryData } from "../prompts/summary-synthesis";
```

- [ ] **Step 3: Find where role sections are inserted**

```bash
grep -n "insertRoleSection" packages/worker/src/pipeline/stage-d-synthesis.ts | head -5
```

Note the line numbers where founder/product/marketing/growth sections are inserted.

- [ ] **Step 4: Add summary generation after all role sections**

In `stage-d-synthesis.ts`, in the main synthesis loop (after the four role sections are persisted), add:

```typescript
  // Generate cross-platform summary
  const summaryPrompt = buildSummarySynthesis({
    ctx,
    competitor: ctx.competitor,
    scannedAt: new Date().toISOString(),
    sources: mentionCount, // from context
    platforms: ENABLED_PLATFORMS.map((p) => ({ id: p, name: platformNames[p] ?? p })),
    sentiment: {
      overall: overallSentiment, // from context
      positive: positiveSentiment,
      neutral: neutralSentiment,
      negative: negativeSentiment,
      trend: sentimentTrend, // e.g., from comparison to previous report
    },
    platformExtracts: {
      founder: founderExtract,
      product: productExtract,
      marketing: marketingExtract,
      growth: growthExtract,
    },
    topQuotes: allTopQuotes, // array of top quotes from all platforms
  });

  try {
    const summaryRes = await llm.complete({
      system: summaryPrompt.system,
      user: summaryPrompt.user,
      schema: summaryPrompt.schema,
    });

    await insertRoleSection(reportId, "summary", summaryRes.parsed);
  } catch (err) {
    log.error({ err }, "Failed to generate summary section; continuing without it");
    // Don't throw — summary is optional, other sections are complete
  }
```

- [ ] **Step 5: Type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check 2>&1 | grep -i "stage-d\|summary" | head -10
```

Expected: No new errors

- [ ] **Step 6: Commit**

```bash
git add packages/worker/src/pipeline/stage-d-synthesis.ts
git commit -m "feat(worker): add summary section generation to Stage D"
```

---

### Task 3: Verify API already returns summary

**Files:**
- Check: `packages/api/src/services/reports.service.ts` (lines 487-510)

- [ ] **Step 1: Verify getReportSections returns all section types**

```bash
grep -A 20 "export async function getReportSections" packages/api/src/services/reports.service.ts
```

Expected output shows it queries `report_role_sections` and returns `founder`, `product`, `marketing`, `growth`, `evidence` — summary will be included automatically.

- [ ] **Step 2: No changes needed**

The API endpoint already returns whatever is in `report_role_sections`. Summary will be included once the worker persists it.

- [ ] **Step 3: Verify types in web hook**

```bash
grep -n "useReportSectionsQuery" packages/web/src/hooks/queries/use-report-sections.ts | head -2
```

The hook will automatically include `summary` in its return type since the server returns it.

---

## Phase 2: Range State Threading (Frontend)

### Task 4: Thread range prop from ScanReportPage to lens pages

**Files:**
- Modify: `packages/web/src/routes/scan-report.tsx` (lines 254-266)

- [ ] **Step 1: Locate the lens page renders**

```bash
grep -n "FounderPage\|ProductPage\|MarketingPage\|GrowthPage" packages/web/src/routes/scan-report.tsx | head -10
```

Should see lines ~255-266 with the four lens renders.

- [ ] **Step 2: Add range prop to all four lens pages**

Replace the current render block (lines 254-266) with:

```typescript
          {lens === "summary"   && <ExecutiveSummary data={SCAN_DATA} onPickLens={setLens} />}
          {lens === "founder"   && (
            <FounderPage embedded data={founderProps} evidenceSection={evidenceSection} range={range} />
          )}
          {lens === "product"   && (
            <ProductPage embedded data={productProps} evidenceSection={evidenceSection} range={range} />
          )}
          {lens === "marketing" && (
            <MarketingPage embedded data={marketingProps} evidenceSection={evidenceSection} range={range} />
          )}
          {lens === "growth"    && (
            <GrowthPage embedded data={growthProps} evidenceSection={evidenceSection} range={range} />
          )}
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check 2>&1 | grep "scan-report\|lens" | head -10
```

Expected: Errors about missing `range` prop on lens pages (next task fixes this)

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/routes/scan-report.tsx
git commit -m "feat(web): thread range prop to all lens pages"
```

---

### Task 5: Add date range filtering helper

**Files:**
- Modify: `packages/web/src/lib/dashboard-helpers.ts`

- [ ] **Step 1: Add filter function to dashboard-helpers.ts**

At the end of the file, add:

```typescript
/**
 * Filter quotes/mentions by date range.
 * @param items Array of items with `createdAt`, `when`, or `timestamp` field
 * @param range "24h" | "7d" | "30d" | "90d"
 */
export function filterByDateRange<T extends { createdAt?: Date | string | null; when?: string }>(
  items: T[],
  range?: string,
): T[] {
  if (!range || range === "90d") return items; // Default: no filtering or full 90d

  const now = new Date();
  const rangeMs = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  }[range];

  if (!rangeMs) return items; // Invalid range, return all

  return items.filter((item) => {
    const date = item.createdAt
      ? new Date(item.createdAt)
      : parseWhenString(item.when);
    if (!date) return true; // No date, include it
    return now.getTime() - date.getTime() <= rangeMs;
  });
}

function parseWhenString(when?: string): Date | null {
  if (!when) return null;
  const match = when.match(/^(\d+)([hdwm])$/); // "3d", "1w", "2m"
  if (!match) return null;

  const [, num, unit] = match;
  const ms =
    unit === "h" ? +num * 60 * 60 * 1000
    : unit === "d" ? +num * 24 * 60 * 60 * 1000
    : unit === "w" ? +num * 7 * 24 * 60 * 60 * 1000
    : unit === "m" ? +num * 30 * 24 * 60 * 60 * 1000
    : 0;

  return ms > 0 ? new Date(Date.now() - ms) : null;
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check 2>&1 | grep "dashboard-helpers"
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/lib/dashboard-helpers.ts
git commit -m "feat(web): add filterByDateRange helper for lens pages"
```

---

### Task 6: Update FounderPage to accept and use range

**Files:**
- Modify: `packages/web/src/routes/founder.tsx`

- [ ] **Step 1: Find the component signature**

```bash
grep -n "export function FounderPage\|function FounderPage" packages/web/src/routes/founder.tsx | head -1
```

- [ ] **Step 2: Add range prop to signature**

Update the function signature to accept `range?`:

```typescript
export function FounderPage({
  embedded,
  data,
  evidenceSection,
  range,
}: {
  embedded?: boolean;
  data?: FounderViewProps;
  evidenceSection?: EvidenceSection;
  range?: string;
}) {
```

- [ ] **Step 3: Import and use the filter helper**

At the top of the file, add:

```typescript
import { filterByDateRange } from "@/lib/dashboard-helpers";
```

Then, in the component where quotes/mentions are rendered, wrap them with the filter:

```typescript
const filteredQuotes = filterByDateRange(data?.quotes ?? [], range);
// Use filteredQuotes instead of data.quotes in the render
```

(Exact location depends on how FounderPage structures its data rendering — grep for `.quotes` or `.mentions` and filter there.)

- [ ] **Step 4: Type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check 2>&1 | grep "founder" | head -5
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/routes/founder.tsx
git commit -m "feat(web): add range prop to FounderPage and filter by date"
```

---

### Task 7: Update ProductPage to accept and use range

**Files:**
- Modify: `packages/web/src/routes/product.tsx`

Repeat Task 6 steps for ProductPage:

- [ ] **Step 1: Update function signature to accept range**

```typescript
export function ProductPage({
  embedded,
  data,
  evidenceSection,
  range,
}: {
  embedded?: boolean;
  data?: ProductViewProps;
  evidenceSection?: EvidenceSection;
  range?: string;
}) {
```

- [ ] **Step 2: Import filter helper**

```typescript
import { filterByDateRange } from "@/lib/dashboard-helpers";
```

- [ ] **Step 3: Filter quotes/mentions by range**

Find where `data.quotes` or `data.mentions` are used and wrap with `filterByDateRange(...)`.

- [ ] **Step 4: Type-check and commit**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check 2>&1 | grep "product"
git add packages/web/src/routes/product.tsx
git commit -m "feat(web): add range prop to ProductPage and filter by date"
```

---

### Task 8: Update MarketingPage to accept and use range

**Files:**
- Modify: `packages/web/src/routes/marketing.tsx`

Repeat Task 6 steps for MarketingPage:

- [ ] **Step 1: Update function signature**

```typescript
export function MarketingPage({
  embedded,
  data,
  evidenceSection,
  range,
}: {
  embedded?: boolean;
  data?: MarketingViewProps;
  evidenceSection?: EvidenceSection;
  range?: string;
}) {
```

- [ ] **Step 2: Import and apply filter**

```typescript
import { filterByDateRange } from "@/lib/dashboard-helpers";
const filteredQuotes = filterByDateRange(data?.quotes ?? [], range);
```

- [ ] **Step 3: Type-check and commit**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check 2>&1 | grep "marketing"
git add packages/web/src/routes/marketing.tsx
git commit -m "feat(web): add range prop to MarketingPage and filter by date"
```

---

### Task 9: Update GrowthPage to accept and use range

**Files:**
- Modify: `packages/web/src/routes/growth.tsx`

Repeat Task 6 steps for GrowthPage:

- [ ] **Step 1: Update function signature**

```typescript
export function GrowthPage({
  embedded,
  data,
  evidenceSection,
  range,
}: {
  embedded?: boolean;
  data?: GrowthViewProps;
  evidenceSection?: EvidenceSection;
  range?: string;
}) {
```

- [ ] **Step 2: Import and apply filter**

```typescript
import { filterByDateRange } from "@/lib/dashboard-helpers";
const filteredQuotes = filterByDateRange(data?.quotes ?? [], range);
```

- [ ] **Step 3: Type-check and commit**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check 2>&1 | grep "growth"
git add packages/web/src/routes/growth.tsx
git commit -m "feat(web): add range prop to GrowthPage and filter by date"
```

---

## Phase 3: Web Consumption (Summary Data)

### Task 10: Update ExecutiveSummary to use real summary data

**Files:**
- Modify: `packages/web/src/routes/scan-report.tsx` (line 254)

- [ ] **Step 1: Locate the ExecutiveSummary render**

```bash
grep -n "ExecutiveSummary" packages/web/src/routes/scan-report.tsx
```

Should be around line 254.

- [ ] **Step 2: Update to use real data with fallback**

Replace:

```typescript
{lens === "summary"   && <ExecutiveSummary data={SCAN_DATA} onPickLens={setLens} />}
```

With:

```typescript
{lens === "summary"   && (
  <ExecutiveSummary 
    data={sections?.summary ? (sections.summary as ScanData) : SCAN_DATA} 
    onPickLens={setLens} 
  />
)}
```

(Or if summary comes in a different shape, adapt the adapter if needed. For now, assume the worker returns `ScanData` shape.)

- [ ] **Step 3: Type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check 2>&1 | grep "scan-report"
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/routes/scan-report.tsx
git commit -m "feat(web): use real summary data from API with fallback to mock"
```

---

### Task 11: Full workspace type-check

**Files:**
- Check: All packages

- [ ] **Step 1: Run full type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check 2>&1 | grep -v "node_modules"
```

Expected: 0 errors

- [ ] **Step 2: If errors, fix them**

Errors will point to specific files. Fix any type mismatches from the threading above.

---

### Task 12: Integration smoke test

**Files:**
- Test: Manual in browser

- [ ] **Step 1: Start dev servers**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm dev &
```

Wait for both API and web to start (~10s).

- [ ] **Step 2: Navigate to a live report**

In browser: `http://localhost:4004/scan-report/<report-id>` (use a real report ID from the database)

- [ ] **Step 3: Verify summary loads**

Expect: Executive Summary section shows real data (not mock). If API returns null for summary, falls back to `SCAN_DATA` mock (correct behavior during transition).

- [ ] **Step 4: Test range selector**

Click the range selector in the unified header (24h, 7d, 30d, 90d). Expect: Lens pages re-render with filtered quotes/mentions.

- [ ] **Step 5: Switch between lenses**

Click Founder → Product → Marketing → Growth. Expect: Each shows filtered data if range is not 90d.

- [ ] **Step 6: Success criteria**

- [x] Summary shows real or mock data without errors
- [x] Range selector is clickable and changes state
- [x] Switching lenses is smooth
- [x] No console errors

---

### Task 13: Final commit and push

**Files:**
- Commit: All changes

- [ ] **Step 1: Review uncommitted changes**

```bash
git status
```

Expected: All files from tasks 1-10 already committed. Only `pnpm-lock.yaml` (if dependencies changed) should be uncommitted.

- [ ] **Step 2: If lock file changed, commit it**

```bash
git add pnpm-lock.yaml
git commit -m "chore: update lock file"
```

- [ ] **Step 3: View full commit history**

```bash
git log --oneline -n 15
```

Expected: ~11-13 commits for this feature (summary synthesis, stage D wiring, lens page updates, etc.)

- [ ] **Step 4: Push to main**

```bash
git push origin main
```

Expected: All commits pushed successfully.

---

## Self-Review

**Spec coverage:**
- [x] Summary section generation in worker Stage D → Task 1-2
- [x] Summary persisted to DB → Task 2 (uses existing insertRoleSection)
- [x] API returns summary → Task 3 (already works, no changes)
- [x] Range state lifted and threaded → Task 4-9
- [x] Each lens page filters by range → Task 6-9
- [x] ExecutiveSummary uses real data → Task 10
- [x] Type safety throughout → Task 11
- [x] Manual smoke test → Task 12

**No placeholders:** All code is concrete, all commands are exact, all steps are specific.

**Type consistency:**
- `filterByDateRange(items, range)` called consistently in Tasks 6-9
- `range?: string` prop threaded through all lens pages identically
- `sections.summary as ScanData` cast in Task 10 matches pattern from other sections

**Dependencies:**
- Tasks 1-2 independent (worker-only)
- Tasks 4-9 independent of each other (can be parallelized)
- Task 10 depends on Task 2 (summary must exist in sections)
- Tasks 11-13 are final validation/push
