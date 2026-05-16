import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  users,
  competitors,
  radar_events,
  reports,
  report_complaints,
  report_feature_gaps,
  report_pricing_tiers,
  report_pricing_quotes,
  report_switching,
  report_quotes,
  report_voice_words,
  report_positioning,
  report_actions,
  report_leads,
  report_opportunities,
  report_platform_stats,
  report_subreddits,
  report_threads,
  report_thread_messages,
} from "@/db/schema";
import { MOCK_DATA } from "../../../web/src/lib/mock/data";

function parseRelative(rel: string): Date {
  const now = Date.now();
  const m = rel.match(/^(\d+)\s*(m|h|d|w)/i);
  if (!m) return new Date(now);
  const n = Number(m[1]);
  const unit = m[2]!.toLowerCase();
  const ms =
    unit === "m"
      ? n * 60_000
      : unit === "h"
        ? n * 3_600_000
        : unit === "d"
          ? n * 86_400_000
          : n * 7 * 86_400_000;
  return new Date(now - ms);
}

async function main() {
  console.log("Truncating tables...");
  await db.execute(sql`TRUNCATE TABLE
    report_thread_messages,
    report_threads,
    report_subreddits,
    report_platform_stats,
    report_opportunities,
    report_leads,
    report_actions,
    report_positioning,
    report_voice_words,
    report_quotes,
    report_switching,
    report_pricing_quotes,
    report_pricing_tiers,
    report_feature_gaps,
    report_complaints,
    reports,
    radar_events,
    competitors,
    users
    RESTART IDENTITY CASCADE`);

  const counts: Record<string, number> = {};

  console.log("Inserting demo user...");
  const [demo] = await db
    .insert(users)
    .values({ email: "demo@rivaleye.local", name: "Demo Founder" })
    .returning();
  if (!demo) throw new Error("user insert failed");
  counts.users = 1;

  console.log("Inserting competitors...");
  const slugToId = new Map<string, string>();
  for (const c of MOCK_DATA.competitors) {
    const [row] = await db
      .insert(competitors)
      .values({
        owner_id: demo.id,
        slug: c.id,
        name: c.name,
        website: c.website,
        category: c.category,
        color: c.color,
        priority: c.priority,
        tags: [...c.tags],
        socials: { ...c.socials },
        monitor_enabled: c.monitor.enabled,
        monitor_sensitivity: c.monitor.sensitivity,
        monitor_watch: [...c.monitor.watch],
        notes: c.notes,
        stat_sentiment: c.stats.sentiment,
        stat_mentions: c.stats.mentions,
        stat_alerts_7d: c.stats.alerts7d,
        last_activity_at: new Date(),
        added_at: new Date(c.added),
      })
      .returning();
    if (row) slugToId.set(c.id, row.id);
  }
  counts.competitors = slugToId.size;

  console.log("Inserting radar events...");
  let radarCount = 0;
  for (const e of MOCK_DATA.radarEvents) {
    const compId = slugToId.get(e.competitor);
    if (!compId) continue;
    await db.insert(radar_events).values({
      competitor_id: compId,
      platform: e.platform,
      type: e.type,
      severity: e.severity,
      title: e.title,
      snippet: e.snippet,
      url: e.url,
      who: "who" in e ? e.who : null,
      role: "role" in e ? e.role : null,
      confidence: e.confidence,
      impact: e.impact,
      detected_at: parseRelative(e.detectedAt),
    });
    radarCount++;
  }
  counts.radar_events = radarCount;

  console.log("Inserting main report...");
  const [report] = await db
    .insert(reports)
    .values({
      owner_id: demo.id,
      category: "Project management",
      competitors: ["Linear"],
      audience: "Founders & PMs at growing SaaS teams",
      goal: "find_weaknesses",
      status: "completed",
      stage: "done",
      primary_competitor_name: "Linear",
      primary_competitor_domain: "linear.app",
      scanned_at: new Date("2026-05-12T14:22:00Z"),
      time_range: "Last 90 days",
      total_sources: 1247,
      total_threads: 412,
      sentiment_overall: -0.34,
      sentiment_positive: 0.28,
      sentiment_neutral: 0.31,
      sentiment_negative: 0.41,
      sentiment_trend: "+0.08 vs prev 90d",
      sentiment_series: [...MOCK_DATA.sentimentSeries],
      voice_summary: MOCK_DATA.voiceOfCustomer.summary,
      voice_phrases: [...MOCK_DATA.voiceOfCustomer.phrases],
      pricing_blended: MOCK_DATA.pricing.blended,
      pricing_pain_score: MOCK_DATA.pricing.painScore,
      switching_net_signal: MOCK_DATA.switching.netSignal,
      switching_reasons_out: [...MOCK_DATA.switching.reasonsOut],
    })
    .returning();
  if (!report) throw new Error("report insert failed");
  counts.reports = 1;
  const rid = report.id;

  console.log("Inserting report children...");
  const complaintRows = await db
    .insert(report_complaints)
    .values(
      MOCK_DATA.complaints.map((c, i) => ({
        report_id: rid,
        external_id: c.id,
        title: c.title,
        tag: c.tag,
        mentions: c.mentions,
        delta: c.delta,
        severity: c.severity,
        summary: c.summary,
        threads: c.threads,
        sample: c.sample,
        sort_order: i,
      })),
    )
    .returning();
  counts.report_complaints = complaintRows.length;

  await db.insert(report_feature_gaps).values(
    MOCK_DATA.featureGaps.map((g, i) => ({
      report_id: rid,
      feature: g.feature,
      votes: g.votes,
      signal: g.signal,
      sort_order: i,
    })),
  );
  counts.report_feature_gaps = MOCK_DATA.featureGaps.length;

  await db.insert(report_pricing_tiers).values(
    MOCK_DATA.pricing.breakdown.map((t, i) => ({
      report_id: rid,
      tier: t.tier,
      pain: t.pain,
      note: t.note,
      sort_order: i,
    })),
  );
  counts.report_pricing_tiers = MOCK_DATA.pricing.breakdown.length;

  await db.insert(report_pricing_quotes).values(
    MOCK_DATA.pricing.quotes.map((q, i) => ({
      report_id: rid,
      who: q.who,
      sub: q.sub,
      text: q.text,
      sort_order: i,
    })),
  );
  counts.report_pricing_quotes = MOCK_DATA.pricing.quotes.length;

  const switchingRows = [
    ...MOCK_DATA.switching.inbound.map((s, i) => ({
      report_id: rid,
      direction: "inbound" as const,
      competitor_name: s.from,
      count: s.count,
      share: s.share,
      sort_order: i,
    })),
    ...MOCK_DATA.switching.outbound.map((s, i) => ({
      report_id: rid,
      direction: "outbound" as const,
      competitor_name: s.to,
      count: s.count,
      share: s.share,
      sort_order: i,
    })),
  ];
  await db.insert(report_switching).values(switchingRows);
  counts.report_switching = switchingRows.length;

  await db.insert(report_quotes).values(
    MOCK_DATA.quotes.map((q, i) => ({
      report_id: rid,
      who: q.who,
      sub: q.sub,
      when_label: q.when,
      score: q.score,
      sentiment: q.sentiment,
      text: q.text,
      sort_order: i,
    })),
  );
  counts.report_quotes = MOCK_DATA.quotes.length;

  const voiceRows = [
    ...MOCK_DATA.voiceOfCustomer.positive.map((w, i) => ({
      report_id: rid,
      kind: "positive" as const,
      word: w.word,
      count: w.count,
      sort_order: i,
    })),
    ...MOCK_DATA.voiceOfCustomer.negative.map((w, i) => ({
      report_id: rid,
      kind: "negative" as const,
      word: w.word,
      count: w.count,
      sort_order: i,
    })),
  ];
  await db.insert(report_voice_words).values(voiceRows);
  counts.report_voice_words = voiceRows.length;

  await db.insert(report_positioning).values(
    MOCK_DATA.positioning.map((p, i) => ({
      report_id: rid,
      angle: p.angle,
      thesis: p.thesis,
      audience: p.audience,
      against: p.against,
      sort_order: i,
    })),
  );
  counts.report_positioning = MOCK_DATA.positioning.length;

  await db.insert(report_actions).values(
    MOCK_DATA.actions.map((a, i) => ({
      report_id: rid,
      step: a.step,
      detail: a.detail,
      effort: a.effort,
      role: a.role,
      sort_order: i,
    })),
  );
  counts.report_actions = MOCK_DATA.actions.length;

  await db.insert(report_leads).values(
    MOCK_DATA.highIntentLeads.map((l, i) => ({
      report_id: rid,
      who: l.who,
      sub: l.sub,
      when_label: l.when,
      score: l.score,
      signal: l.signal,
      quote: l.quote,
      sort_order: i,
    })),
  );
  counts.report_leads = MOCK_DATA.highIntentLeads.length;

  await db.insert(report_opportunities).values(
    MOCK_DATA.opportunities.map((o, i) => ({
      report_id: rid,
      title: o.title,
      thesis: o.thesis,
      effort: o.effort,
      payoff: o.payoff,
      anchor_complaint_external_id: o.anchorComplaint,
      sort_order: i,
    })),
  );
  counts.report_opportunities = MOCK_DATA.opportunities.length;

  await db.insert(report_platform_stats).values(
    MOCK_DATA.competitor.platforms.map((p, i) => ({
      report_id: rid,
      platform_id: p.id,
      name: p.name,
      posts: p.posts,
      sentiment: p.sentiment,
      contexts: [...p.contexts],
      sort_order: i,
    })),
  );
  counts.report_platform_stats = MOCK_DATA.competitor.platforms.length;

  await db.insert(report_subreddits).values(
    MOCK_DATA.competitor.subreddits.map((s, i) => ({
      report_id: rid,
      name: s.name,
      posts: s.posts,
      sentiment: s.sentiment,
      sort_order: i,
    })),
  );
  counts.report_subreddits = MOCK_DATA.competitor.subreddits.length;

  console.log("Inserting threads...");
  const threadRows = await db
    .insert(report_threads)
    .values(
      MOCK_DATA.complaints.map((c, i) => ({
        report_id: rid,
        complaint_external_id: c.id,
        platform: "reddit",
        url: null,
        title: c.title,
        author: "u/anon",
        sub: "r/SaaS",
        posted_at: new Date(Date.now() - (i + 1) * 86_400_000),
        score: c.mentions,
        sort_order: i,
      })),
    )
    .returning();
  counts.report_threads = threadRows.length;

  const messageRows = threadRows.flatMap((t, i) => {
    const c = MOCK_DATA.complaints[i];
    if (!c) return [];
    return [
      {
        thread_id: t.id,
        author: "u/anon",
        body: c.sample,
        posted_at: new Date(Date.now() - (i + 1) * 86_400_000),
        score: Math.floor(c.mentions / 2),
        sort_order: 0,
      },
      {
        thread_id: t.id,
        author: "u/replier",
        body: c.summary,
        posted_at: new Date(Date.now() - (i + 1) * 86_400_000 + 3_600_000),
        score: Math.floor(c.mentions / 4),
        sort_order: 1,
      },
    ];
  });
  if (messageRows.length) {
    await db.insert(report_thread_messages).values(messageRows);
  }
  counts.report_thread_messages = messageRows.length;

  console.log("\nSeeded rows:");
  let total = 0;
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k}: ${v}`);
    total += v;
  }
  console.log(`\nTotal: ${total} rows`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
