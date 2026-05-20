import { z } from "zod";

export const platformIdSchema = z.enum([
  "reddit",
  "appstore",
  "playstore",
  "hackernews",
  "producthunt",
  "devto",
]);

export const switchingDirectionSchema = z.enum(["inbound", "outbound"]);

export const platformExtractSchema = z.object({
  complaints: z.array(
    z.object({
      text: z.string().min(1),
      severity: z.number().min(0).max(1),
      evidence_ids: z.array(z.string()).default([]),
    }),
  ),
  features_requested: z.array(
    z.object({ feature: z.string().min(1), evidence_ids: z.array(z.string()).default([]) }),
  ),
  pricing_signals: z.array(
    z.object({ note: z.string().min(1), evidence_ids: z.array(z.string()).default([]) }),
  ),
  switching_signals: z.array(
    z.object({
      direction: switchingDirectionSchema,
      competitor: z.string().min(1),
      evidence_ids: z.array(z.string()).default([]),
    }),
  ),
  voice_phrases: z.object({
    positive: z.array(z.string()),
    negative: z.array(z.string()),
  }),
  notable_quotes: z.array(
    z.object({
      author: z.string(),
      text: z.string().min(1),
      evidence_id: z.string(),
    }),
  ),
});

export const platformBriefSchema = z.object({
  platform: platformIdSchema,
  headline: z.string().min(1),
  top_themes: z.array(z.object({ theme: z.string().min(1), weight: z.number().min(0).max(1) })),
  sentiment: z.object({
    positive: z.number().min(0).max(1),
    neutral: z.number().min(0).max(1),
    negative: z.number().min(0).max(1),
  }),
  most_quoted_competitors: z.array(z.string()),
  evidence_coverage: z.number().min(0).max(1),
});

export const mergedClustersSchema = z.object({
  complaint_clusters: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
      severity: z.number().min(0).max(1),
      platforms: z.array(platformIdSchema),
      evidence_ids: z.array(z.string()),
      sample_quote: z.string().nullable(),
    }),
  ),
  feature_clusters: z.array(
    z.object({
      feature: z.string(),
      demand_score: z.number().min(0).max(1),
      platforms: z.array(platformIdSchema),
      evidence_ids: z.array(z.string()),
    }),
  ),
  pricing_clusters: z.array(
    z.object({
      tier_label: z.string(),
      pain: z.number().min(0).max(1),
      note: z.string(),
      platforms: z.array(platformIdSchema),
      sample_quotes: z.array(z.object({ who: z.string(), text: z.string() })),
    }),
  ),
  switching_clusters: z.array(
    z.object({
      direction: switchingDirectionSchema,
      competitor: z.string(),
      count: z.number().int().nonnegative(),
      share: z.number().min(0).max(1),
      platforms: z.array(platformIdSchema),
    }),
  ),
  voice_top: z.object({
    positive: z.array(z.object({ word: z.string(), count: z.number().int().nonnegative() })),
    negative: z.array(z.object({ word: z.string(), count: z.number().int().nonnegative() })),
  }),
  cross_platform_themes: z.array(
    z.object({
      theme: z.string(),
      platforms: z.array(platformIdSchema),
      weight: z.number().min(0).max(1),
    }),
  ),
});

export const sentimentTrendEnum = z.enum(["up", "down", "flat"]);
export const effortEnum = z.enum(["low", "med", "high"]);
export const payoffEnum = z.enum(["low", "med", "high"]);

export const synthOutputSchema = z.object({
  complaints: z.array(
    z.object({
      external_id: z.string(),
      title: z.string(),
      tag: z.string().nullable(),
      mentions: z.number().int().nonnegative(),
      delta: z.string().nullable(),
      severity: z.number().min(0).max(1),
      summary: z.string().nullable(),
      threads: z.number().int().nonnegative(),
      sample: z.string().nullable(),
    }),
  ),
  feature_gaps: z.array(
    z.object({
      feature: z.string(),
      votes: z.number().int().nonnegative(),
      signal: z.number().min(0).max(1),
    }),
  ),
  pricing_tiers: z.array(
    z.object({ tier: z.string(), pain: z.number().min(0).max(1), note: z.string().nullable() }),
  ),
  pricing_quotes: z.array(
    z.object({ who: z.string(), sub: z.string().nullable(), text: z.string() }),
  ),
  switching: z.array(
    z.object({
      direction: switchingDirectionSchema,
      competitor_name: z.string(),
      count: z.number().int().nonnegative(),
      share: z.number().min(0).max(1),
    }),
  ),
  quotes: z.array(
    z.object({
      who: z.string(),
      sub: z.string().nullable(),
      when_label: z.string().nullable(),
      score: z.number().int(),
      sentiment: z.number().nullable().catch(null),
      text: z.string(),
    }),
  ),
  voice_words: z.array(
    z.object({
      kind: z.enum(["positive", "negative"]),
      word: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
  positioning: z.array(
    z.object({
      angle: z.string(),
      thesis: z.string().nullable(),
      audience: z.string().nullable(),
      against: z.string().nullable(),
    }),
  ),
  actions: z.array(
    z.object({
      step: z.string(),
      detail: z.string().nullable(),
      effort: effortEnum,
      role: z.string().nullable(),
    }),
  ),
  leads: z.array(
    z.object({
      who: z.string(),
      sub: z.string().nullable(),
      when_label: z.string().nullable(),
      score: z.number().int(),
      signal: z.string().nullable(),
      quote: z.string().nullable(),
    }),
  ),
  opportunities: z.array(
    z.object({
      title: z.string(),
      thesis: z.string().nullable(),
      effort: effortEnum,
      payoff: payoffEnum,
      anchor_complaint_external_id: z.string().nullable(),
    }),
  ),
  threads: z.array(
    z.object({
      complaint_external_id: z.string().nullable(),
      platform: platformIdSchema,
      url: z.string().nullable(),
      title: z.string(),
      author: z.string().nullable(),
      sub: z.string().nullable(),
      posted_at: z.string().datetime().nullable(),
      score: z.number().int(),
      messages: z
        .array(
          z.object({
            author: z.string().nullable(),
            body: z.string(),
            posted_at: z.string().datetime().nullable(),
            score: z.number().int(),
          }),
        )
        .default([]),
    }),
  ),
  report_meta: z.object({
    sentiment_overall: z.number().min(-1).max(1),
    sentiment_positive: z.number().min(0).max(1),
    sentiment_neutral: z.number().min(0).max(1),
    sentiment_negative: z.number().min(0).max(1),
    sentiment_trend: sentimentTrendEnum,
    voice_summary: z.string().nullable(),
    voice_phrases: z.array(z.string()),
    pricing_blended: z.string().nullable(),
    pricing_pain_score: z.number().min(0).max(1).nullable(),
    switching_net_signal: z.string().nullable(),
    switching_reasons_out: z.array(z.string()),
  }),
  executive_brief: z.string().min(1),
});

export type PlatformExtract = z.infer<typeof platformExtractSchema>;
export type PlatformBrief = z.infer<typeof platformBriefSchema>;
export type MergedClusters = z.infer<typeof mergedClustersSchema>;
export type SynthOutput = z.infer<typeof synthOutputSchema>;

export interface PipelineCtx {
  reportId: string;
  competitor: string;
  category: string;
  audience: string | null;
  goal: string;
}
