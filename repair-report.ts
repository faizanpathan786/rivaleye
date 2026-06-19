/**
 * Repair script for reports whose persist transaction rolled back silently,
 * leaving the report with 0 mentions / 0 platforms.
 *
 * Usage:
 *   bun repair-report.ts <report-id>
 *
 * Example:
 *   bun repair-report.ts f73f10c3-232a-4b1d-8714-37634f3c4ece
 *
 * Requires CONNECTION_STRING env var (same as the app).
 * Safe to run multiple times — clears and re-inserts all sub-tables.
 */
import postgres from "./node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js";

const id = process.argv[2];
if (!id) {
  console.error("Usage: bun repair-report.ts <report-id>");
  process.exit(1);
}

const sql = postgres(process.env.CONNECTION_STRING!, { ssl: "require", max: 1 });

console.log(`\nRepairing report: ${id}`);

// Load E checkpoint
const [eRow] = await sql`SELECT output FROM report_pipeline_checkpoints WHERE report_id = ${id} AND stage = 'E'`;
if (!eRow) {
  console.error(`No E checkpoint found for report ${id}. Pipeline may not have completed Stage E yet.`);
  await sql.end();
  process.exit(1);
}

const e = eRow.output as Record<string, unknown>;
type Rec = Record<string, unknown>;

const complaints    = (e.complaints    as Rec[]) ?? [];
const featureGaps   = (e.feature_gaps  as Rec[]) ?? [];
const pricingTiers  = (e.pricing_tiers as Rec[]) ?? [];
const pricingQuotes = (e.pricing_quotes as Rec[]) ?? [];
const switching     = (e.switching     as Rec[]) ?? [];
const quotes        = (e.quotes        as Rec[]) ?? [];
const voiceWords    = (e.voice_words   as Rec[]) ?? [];
const positioning   = (e.positioning   as Rec[]) ?? [];
const actions       = (e.actions       as Rec[]) ?? [];
const leads         = (e.leads         as Rec[]) ?? [];
const opportunities = (e.opportunities as Rec[]) ?? [];
const meta          = (e.report_meta   as Rec)   ?? {};
const execBrief     = (e.executive_brief as string) ?? null;

// Platform stats from mentions
const mentionRows = await sql`SELECT platform FROM mentions WHERE report_id = ${id}`;
const platCounts = new Map<string, number>();
for (const m of mentionRows) platCounts.set(m.platform, (platCounts.get(m.platform) ?? 0) + 1);
const LABELS: Record<string, string> = {
  reddit: "Reddit", producthunt: "Product Hunt", appstore: "App Store",
  playstore: "Play Store", hackernews: "Hacker News", twitter: "Twitter / X",
  linkedin: "LinkedIn", g2: "G2", capterra: "Capterra", trustpilot: "Trustpilot",
};
const platformStats = Array.from(platCounts.entries())
  .sort(([, a], [, b]) => b - a)
  .map(([platform, count]) => ({ platform, label: LABELS[platform] ?? platform, count }));
const totalSources = platformStats.reduce((s, p) => s + p.count, 0);

console.log(`  complaints: ${complaints.length}`);
console.log(`  quotes: ${quotes.length}`);
console.log(`  feature_gaps: ${featureGaps.length}`);
console.log(`  voice_words: ${voiceWords.length}`);
console.log(`  pricing_tiers: ${pricingTiers.length}`);
console.log(`  positioning: ${positioning.length}`);
console.log(`  actions: ${actions.length}`);
console.log(`  switching: ${switching.length}`);
console.log(`  opportunities: ${opportunities.length}`);
console.log(`  platforms: ${platformStats.length}, total_sources: ${totalSources}`);

// Clear existing sub-tables (idempotent)
await sql`DELETE FROM report_complaints      WHERE report_id = ${id}`;
await sql`DELETE FROM report_feature_gaps    WHERE report_id = ${id}`;
await sql`DELETE FROM report_pricing_tiers   WHERE report_id = ${id}`;
await sql`DELETE FROM report_pricing_quotes  WHERE report_id = ${id}`;
await sql`DELETE FROM report_switching       WHERE report_id = ${id}`;
await sql`DELETE FROM report_quotes          WHERE report_id = ${id}`;
await sql`DELETE FROM report_voice_words     WHERE report_id = ${id}`;
await sql`DELETE FROM report_positioning     WHERE report_id = ${id}`;
await sql`DELETE FROM report_actions         WHERE report_id = ${id}`;
await sql`DELETE FROM report_leads           WHERE report_id = ${id}`;
await sql`DELETE FROM report_opportunities   WHERE report_id = ${id}`;
await sql`DELETE FROM report_platform_stats  WHERE report_id = ${id}`;
await sql`DELETE FROM report_subreddits      WHERE report_id = ${id}`;

// Re-insert sub-tables
if (complaints.length) {
  await sql`INSERT INTO report_complaints ${sql(complaints.map((c, i) => ({ report_id: id, external_id: c.external_id as string, title: c.title as string, tag: (c.tag as string) ?? null, mentions: (c.mentions as number) ?? 0, delta: (c.delta as string) ?? null, severity: (c.severity as number) ?? 0, summary: (c.summary as string) ?? null, threads: (c.threads as number) ?? 0, sample: (c.sample as string) ?? null, sample_author: null, sort_order: i })))}`;
  console.log(`  ✓ inserted ${complaints.length} complaints`);
}

if (quotes.length) {
  await sql`INSERT INTO report_quotes ${sql(quotes.map((q, i) => ({ report_id: id, who: q.who as string, sub: (q.sub as string) ?? null, when_label: (q.when_label as string) ?? null, score: (q.score as number) ?? 0, sentiment: (q.sentiment as number) ?? null, text: q.text as string, sort_order: i })))}`;
  console.log(`  ✓ inserted ${quotes.length} quotes`);
}

if (featureGaps.length) {
  await sql`INSERT INTO report_feature_gaps ${sql(featureGaps.map((f, i) => ({ report_id: id, feature: f.feature as string, votes: (f.votes as number) ?? 0, signal: (f.signal as number) ?? 0, sort_order: i })))}`;
  console.log(`  ✓ inserted ${featureGaps.length} feature_gaps`);
}

if (voiceWords.length) {
  await sql`INSERT INTO report_voice_words ${sql(voiceWords.map((w, i) => ({ report_id: id, kind: w.kind as string, word: w.word as string, count: (w.count as number) ?? 0, sort_order: i })))}`;
  console.log(`  ✓ inserted ${voiceWords.length} voice_words`);
}

if (pricingTiers.length) {
  await sql`INSERT INTO report_pricing_tiers ${sql(pricingTiers.map((t, i) => ({ report_id: id, tier: t.tier as string, pain: (t.pain as number) ?? 0, note: (t.note as string) ?? null, sort_order: i })))}`;
  console.log(`  ✓ inserted ${pricingTiers.length} pricing_tiers`);
}

if (positioning.length) {
  await sql`INSERT INTO report_positioning ${sql(positioning.map((p, i) => ({ report_id: id, angle: p.angle as string, thesis: p.thesis as string, audience: (p.audience as string) ?? null, against: (p.against as string) ?? null, sort_order: i })))}`;
  console.log(`  ✓ inserted ${positioning.length} positioning`);
}

if (actions.length) {
  await sql`INSERT INTO report_actions ${sql(actions.map((a, i) => ({ report_id: id, step: a.step as string, detail: (a.detail as string) ?? null, effort: (a.effort as string) ?? null, role: (a.role as string) ?? null, sort_order: i })))}`;
  console.log(`  ✓ inserted ${actions.length} actions`);
}

if (switching.length) {
  await sql`INSERT INTO report_switching ${sql(switching.map((s, i) => ({ report_id: id, direction: s.direction as string, competitor_name: s.competitor_name as string, count: (s.count as number) ?? 0, share: (s.share as number) ?? 0, sort_order: i })))}`;
  console.log(`  ✓ inserted ${switching.length} switching`);
}

if (pricingQuotes.length) {
  await sql`INSERT INTO report_pricing_quotes ${sql(pricingQuotes.map((q, i) => ({ report_id: id, who: q.who as string, sub: (q.sub as string) ?? null, text: q.text as string, sort_order: i })))}`;
  console.log(`  ✓ inserted ${pricingQuotes.length} pricing_quotes`);
}

if (opportunities.length) {
  await sql`INSERT INTO report_opportunities ${sql(opportunities.map((o, i) => ({ report_id: id, title: o.title as string, thesis: (o.thesis as string) ?? null, effort: (o.effort as string) ?? "med", payoff: (o.payoff as string) ?? "med", anchor_complaint_external_id: (o.anchor_complaint_external_id as string) ?? null, sort_order: i })))}`;
  console.log(`  ✓ inserted ${opportunities.length} opportunities`);
}

if (platformStats.length) {
  await sql`INSERT INTO report_platform_stats ${sql(platformStats.map((p, i) => ({ report_id: id, platform_id: p.platform, name: p.label, posts: p.count, sort_order: i })))}`;
  console.log(`  ✓ inserted ${platformStats.length} platform_stats`);
}

// Update report meta
await sql`
  UPDATE reports SET
    total_sources        = ${totalSources},
    total_threads        = ${0},
    sentiment_overall    = ${(meta.sentiment_overall    as number) ?? null},
    sentiment_positive   = ${(meta.sentiment_positive   as number) ?? null},
    sentiment_neutral    = ${(meta.sentiment_neutral    as number) ?? null},
    sentiment_negative   = ${(meta.sentiment_negative   as number) ?? null},
    sentiment_trend      = ${(meta.sentiment_trend      as string) ?? null},
    voice_summary        = ${(meta.voice_summary        as string) ?? null},
    executive_brief      = ${execBrief},
    voice_phrases        = ${sql.json((meta.voice_phrases       as string[]) ?? [])},
    pricing_blended      = ${(meta.pricing_blended      as string) ?? null},
    pricing_pain_score   = ${(meta.pricing_pain_score   as number) ?? null},
    switching_net_signal = ${(meta.switching_net_signal as string) ?? null},
    switching_reasons_out = ${sql.json((meta.switching_reasons_out as string[]) ?? [])},
    updated_at           = now()
  WHERE id = ${id}
`;
console.log(`  ✓ updated report meta (total_sources=${totalSources})`);

console.log("\nDone. Hard refresh the report page.");
await sql.end();
