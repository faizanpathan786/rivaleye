# Mock → Backend field map

Reference for all route migration agents. Mock data is camelCase nested; backend is snake_case flat with sub-resources.

## Auth context

- Cookie session via `withCredentials: true`. No bearer token.
- All hooks use `axios` from `@/lib/axios` and types from `@/api/*`.
- Loading + empty + error states required (see web/CLAUDE.md §6).

## Competitor

```ts
// MOCK_DATA.competitors[i]
{ id, name, website, category, color, added, priority, tags,
  socials: { linkedin, twitter, github, youtube, producthunt, blog },
  monitor: { enabled, sensitivity, watch[] },
  stats: { sentiment, mentions, alerts7d, lastActivity },
  notes }

// Backend: api.competitors.list() → Competitor[]
{ id (uuid), owner_id, slug, name, website, category, color, added_at,
  priority, tags, socials: { linkedin, twitter, github, youtube, producthunt, blog },
  monitor_enabled, monitor_sensitivity, monitor_watch[],
  stat_sentiment, stat_mentions, stat_alerts_7d, last_activity_at,
  notes, created_at, updated_at }
```

| mock | backend |
|---|---|
| `c.added` | `c.added_at` (ISO string) |
| `c.monitor.enabled` | `c.monitor_enabled` |
| `c.monitor.sensitivity` | `c.monitor_sensitivity` |
| `c.monitor.watch` | `c.monitor_watch` |
| `c.stats.sentiment` | `c.stat_sentiment` |
| `c.stats.mentions` | `c.stat_mentions` |
| `c.stats.alerts7d` | `c.stat_alerts_7d` |
| `c.stats.lastActivity` (string "47m ago") | `c.last_activity_at` (ISO) — format with `dayjs/date-fns` to "47m ago" via `formatDistanceToNow` or write tiny helper |

## Radar event

```ts
// MOCK_DATA.radarEvents[i]
{ id, competitor (slug like "linear"), platform, type, severity, title, snippet, url, who?, role?, detectedAt: "47m ago", confidence, impact }

// Backend: api.radar.listRadarEvents()
{ id, competitor_id (uuid), platform, type, severity, title, snippet, url, who, role, confidence, impact, detected_at (ISO), created_at }
// + on dashboard endpoint: includes competitor_name (joined)
```

| mock | backend |
|---|---|
| `e.competitor` (slug) | `e.competitor_id` (uuid) — to look up name, join with competitors list, OR use endpoint that includes `competitor_name` |
| `e.detectedAt` (relative string) | `e.detected_at` (ISO) — format with formatRelative |

For routes that filter by competitor slug: load competitors list, build `slug → id` map, pass `competitor_id` as filter param to `/v1/radar/events?competitor_id=<id>`.

## Report (top-level row)

```ts
// MOCK_DATA.competitor (top of report) + MOCK_DATA.sentiment etc.
// Backend: api.reports.getReport(id) → ReportRow
{ id, category, competitors[], audience, goal, status, stage, error,
  primary_competitor_name, primary_competitor_domain, scanned_at, time_range,
  total_sources, total_threads,
  sentiment_overall, sentiment_positive, sentiment_neutral, sentiment_negative,
  sentiment_trend, voice_summary, voice_phrases[],
  pricing_blended, pricing_pain_score,
  switching_net_signal, switching_reasons_out[],
  created_at, updated_at }
```

Mock `MOCK_DATA.competitor.{name, domain, sources, threads, scannedAt, timeRange}` → backend `report.{primary_competitor_name, primary_competitor_domain, total_sources, total_threads, scanned_at, time_range}`

Mock `MOCK_DATA.competitor.sentiment.{overall, positive, neutral, negative, trend}` → backend `report.sentiment_*`

## Report sub-resources

All return arrays via dedicated hooks. Use `useReportComplaintsQuery(id)` etc. Each hook returns `{ data, isLoading, error }` from TanStack Query.

| Mock array | Backend hook | Field map |
|---|---|---|
| `MOCK_DATA.complaints` | `useReportComplaintsQuery(id)` | `c.id`→`c.external_id`; rest same names; backend adds `c.id` (uuid), `c.report_id`, `c.sort_order` |
| `MOCK_DATA.featureGaps` | `useReportFeatureGapsQuery(id)` | same field names |
| `MOCK_DATA.pricing.{breakdown,quotes,blended,painScore}` | `useReportPricingQuery(id)` returns `{ tiers, quotes, blended, pain_score }` | `breakdown` → `tiers`; `painScore` → `pain_score` |
| `MOCK_DATA.switching.{inbound,outbound,netSignal,reasonsOut}` | `useReportSwitchingQuery(id)` returns `{ inbound, outbound, net_signal, reasons_out }` | `inbound[i].from`/`outbound[i].to` → `competitor_name` (with `direction`) |
| `MOCK_DATA.quotes` | `useReportQuotesQuery(id)` | `q.when` → `q.when_label` |
| `MOCK_DATA.voiceOfCustomer.{summary,phrases,positive,negative}` | `useReportVoiceQuery(id)` returns `{ summary, phrases, positive, negative }` | positive/negative items: `{ word, count }` (same) |
| `MOCK_DATA.positioning` | `useReportPositioningQuery(id)` | same field names |
| `MOCK_DATA.actions` | `useReportActionsQuery(id)` | same |
| `MOCK_DATA.highIntentLeads` | `useReportLeadsQuery(id)` | `l.when` → `l.when_label` |
| `MOCK_DATA.opportunities` | `useReportOpportunitiesQuery(id)` | `o.anchorComplaint` → `o.anchor_complaint_external_id` |
| `MOCK_DATA.competitor.platforms` | `useReportPlatformsQuery(id)` | `p.id` → `p.platform_id`; rest same |
| `MOCK_DATA.competitor.subreddits` | `useReportSubredditsQuery(id)` | same names |
| `MOCK_DATA.sentimentSeries` | `useReportSentimentSeriesQuery(id)` returns `number[]` | — |
| `MOCK_DATA.history` (dashboard recent scans) | `useReportsQuery()` | `h.name` → `r.primary_competitor_name`; `h.lastRun` → format `r.created_at`; `h.pain` → `r.sentiment_overall`; `h.mentions` → `r.total_sources`; `h.scans` (per-competitor count) → derive from `useReportsQuery` filtered by competitor name |

## Helpers each agent should write/use

Create `packages/web/src/lib/format.ts` if missing:

```ts
export function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export function formatPercent(n: number | null | undefined, digits = 0): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function formatSignedPercent(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(0)}%`;
}
```

## Loading/error pattern

```tsx
const { data, isLoading, error } = useDashboardQuery();
if (isLoading) return <Skeleton ... />;
if (error) return <ErrorBoundary message="Failed to load" />;
if (!data) return null;
// render
```

For sections with no data yet (mock-only, no backend): leave the section + add `// TODO(backend): wire when X endpoint ships`.
