# Scan Report Live Completion — Summary + Range Filtering

**Date:** 2026-05-26  
**Goal:** Complete the two pending TODOs in scan-report to make the live report view fully functional: generate and persist summary section data, and wire range filtering through the lens pages.

---

## Overview

The scan-report view (`/scan-report/:id`) currently fetches real role sections (founder, product, marketing, growth, evidence) from the API but:
1. Uses a hardcoded mock `SCAN_DATA` for the Executive Summary lens
2. Has range filtering in the header that doesn't actually filter the lens pages

This spec completes both by:
- **Adding summary section synthesis** in the worker (Stage D) and returning it via the existing API endpoint
- **Lifting range state** and threading it through all lens pages so filtering is live

---

## Architecture

### Data Flow

```
[Worker Stage D completes]
    ↓
[Generate summary section via LLM]
    ↓
[Persist to report_role_sections with section_type='summary']
    ↓
[Web: GET /v1/reports/:id/sections returns summary]
    ↓
[ExecutiveSummary uses real data instead of SCAN_DATA]
    ↓
[Range selector in header threads down to all lens pages]
    ↓
[Each lens filters its quotes/mentions by date range]
```

### Summary Section Structure

```typescript
interface SummarySectionData {
  competitor: {
    name: string;
    domain: string;
    scannedAt: string;        // ISO timestamp
    sources: number;           // Total mentions across all platforms
    platforms: Array<{ id: string; name: string }>;
    sentiment: {
      overall: number;        // -1 to 1
      positive: number;       // 0 to 1
      neutral: number;        // 0 to 1
      negative: number;       // 0 to 1
      trend: string;          // e.g., "+0.08 vs prev 90d"
    };
  };
  headlines: {
    mainThesis: string;       // One-line competitive insight
    insights: string;         // 1-2 sentence narrative
  };
  topThemes: Array<{
    name: string;
    mentions: number;
    trend: string;            // e.g., "+34%"
  }>;
  topQuotes: Array<{
    who: string;
    sub: string;              // e.g., "r/SaaS"
    when: string;             // e.g., "3d", "1w"
    score: number;
    sentiment: number;
    text: string;
    theme: string;            // Category this quote belongs to
  }>;
}
```

---

## Implementation Tasks

### Phase 1: Summary Section Generation (Worker + API)

**1.1 Create summary synthesis prompt**
- File: `packages/worker/src/prompts/summary-synthesis.ts`
- Input: all four role-section extracts + overall evidence stats (source count, sentiment, top themes)
- Output: structured summary data matching `SummarySectionData`
- Prompt instructs LLM to:
  - Synthesize a one-line main thesis from cross-cutting themes
  - Write a supporting narrative (1-2 sentences)
  - Extract top 3 themes with mention counts and trends
  - Select 3 anchor quotes (highest-signal across all platforms)

**1.2 Wire summary generation into Stage D**
- File: `packages/worker/src/pipeline/stage-d-synthesis.ts`
- After generating all four role sections, call summary synthesizer
- Persist result via `insertRoleSection(reportId, "summary", summaryData)`
- Handle LLM failures gracefully (log, continue; web will use mock fallback)

**1.3 Verify API returns summary**
- File: `packages/api/src/services/reports.service.ts`
- Function `getReportSections` already queries `report_role_sections` — no changes needed
- Test: `GET /v1/reports/:id/sections` returns summary field

### Phase 2: Range State Threading (Frontend)

**2.1 Update ScanReportPage to thread range**
- File: `packages/web/src/routes/scan-report.tsx`
- Render: `<FounderPage range={range} ... />`, `<ProductPage range={range} ... />`, etc.
- Each lens page already receives `data` and `evidenceSection` — add `range` as third prop

**2.2 Add range filtering to each lens page**
- Files: `packages/web/src/routes/founder.tsx`, `product.tsx`, `marketing.tsx`, `growth.tsx`
- Accept `range?: string` prop
- Filter `data.quotes` (if present) by `createdAt` or `when` field
- Helper function: `filterByDateRange(quotes, range)` in `packages/web/src/lib/dashboard-helpers.ts`
  - `"90d"` → last 90 days
  - `"30d"` → last 30 days
  - `"7d"` → last 7 days
  - `"24h"` → last 24 hours
- Re-render when `range` changes (via React.memo dependency)

**2.3 Update EvidenceSection to respect range**
- File: `packages/web/src/lib/dashboard-helpers.ts`
- `EvidenceSection` component filters its evidence/quotes by range before rendering

### Phase 3: Web Consumption (Summary Data)

**3.1 Update ExecutiveSummary to use real data**
- File: `packages/web/src/routes/scan-report.tsx`
- Change: `<ExecutiveSummary data={SCAN_DATA} ... />` → `<ExecutiveSummary data={sections?.summary} ... />`
- Add fallback: if `sections?.summary` is null, render a "generating" state or use `SCAN_DATA` mock
- Type safety: cast `sections.summary as SummarySectionData` (same pattern as other sections)

**3.2 Adapt ExecutiveSummary if data shape differs**
- The mock `SCAN_DATA` has quotes array; real data has `topQuotes`
- Adjust which quotes are displayed in "The Three Quotes That Say It All" section if needed

---

## Error Handling

**Summary generation fails in worker:**
- Log error, continue pipeline
- Set `report_role_sections` for summary to NULL
- Web shows loading state briefly, then falls back to mock `SCAN_DATA`

**Summary is missing from sections payload:**
- Web treats it as null, uses `SCAN_DATA` fallback
- No breaking change to existing logic

**Range filtering edge cases:**
- If `range` is invalid or missing, default to `"90d"`
- If `createdAt` or `when` is missing on a quote, exclude it from range filtering
- If filtered result is empty, still render the lens (shows empty message)

---

## Data Model Changes

**No schema changes.** Summary is persisted to existing `report_role_sections` table with `section_type='summary'`.

---

## Testing

**Worker:**
- Unit test summary synthesis prompt with mock extracts
- Verify LLM returns valid `SummarySectionData` shape

**API:**
- Integration test: run full pipeline, verify `GET /reports/:id/sections` includes summary

**Web:**
- Visual test: render ExecutiveSummary with real summary data
- Interaction test: change range selector, verify lens pages re-filter and re-render
- Fallback test: set sections.summary to null, verify mock `SCAN_DATA` is used

---

## Success Criteria

- [ ] `/scan-report/:id` loads and displays Executive Summary with real data (not mock)
- [ ] Range selector in header affects all four lens pages (quotes/mentions filtered by date)
- [ ] Fallback to mock data works if summary generation fails
- [ ] Type safety across all sections (no `any`)
- [ ] No breaking changes to existing API contracts

---

## Dependencies & Sequencing

1. Summary synthesis prompt (worker) — no dependencies
2. Stage D integration (worker) — depends on (1)
3. Range filtering (web) — independent, can be done in parallel
4. ExecutiveSummary consumption (web) — depends on (2)

All can ship in a single PR or two parallel PRs (worker + web).

---

## Future Enhancements (Out of scope)

- Configurable range options (currently hardcoded: 24h, 7d, 30d, 90d)
- Export summary as markdown/PDF
- A/B test different summary prompts for quality
- Cache summary for 24h to reduce LLM calls on re-views
