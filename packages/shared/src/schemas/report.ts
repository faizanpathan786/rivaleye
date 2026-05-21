import { z } from "zod";

export const reportGoalSchema = z.enum([
  "validate_idea",
  "find_weaknesses",
  "improve_positioning",
  "decide_mvp_features",
  "find_user_pain",
  "compare_alternatives",
]);
export type ReportGoal = z.infer<typeof reportGoalSchema>;

export const platformIdSchema = z.enum([
  "reddit",
  "g2",
  "capterra",
  "twitter",
  "linkedin",
  "producthunt",
  "appstore",
  "playstore",
  "gmaps",
]);
export type PlatformId = z.infer<typeof platformIdSchema>;

// Task 0.1
export const reportStageSchema = z.enum([
  "queued",
  "scraping",
  "clustering",
  "done",
  "failed",
]);
export type ReportStage = z.infer<typeof reportStageSchema>;

// Task 0.2 — PRD §10 reportOutputSchema
export const sourceSchema = z.object({
  post_id: z.string(),
  url: z.string().optional(),
  title: z.string().optional(),
  subreddit: z.string().optional(),
  score: z.number().optional(),
  created_utc: z.number().optional(),
});

export const evidenceSchema = z.object({
  post_ids: z.array(z.string()),
  top_quotes: z.array(z.string()),
});

export const painClusterSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  frequency: z.number(),
  evidence: evidenceSchema,
  scores: z
    .object({
      pain_score: z.number(),
      intensity: z.number(),
      specificity: z.number(),
      recency_days: z.number(),
    })
    .optional(),
});

export const featureGapSchema = z.object({
  title: z.string(),
  description: z.string(),
  evidence: evidenceSchema,
  priority: z.enum(["high", "medium", "low"]).optional(),
});

export const switchingSignalSchema = z.object({
  signal: z.string(),
  evidence: evidenceSchema,
});

export const opportunitySchema = z.object({
  title: z.string(),
  description: z.string(),
  evidence: evidenceSchema,
  scores: z
    .object({
      opportunity_score: z.number(),
      market_pain: z.number(),
      differentiation: z.number(),
      evidence_count: z.number(),
    })
    .optional(),
});

export const vocPhraseSchema = z.object({
  phrase: z.string(),
  frequency: z.number(),
  example_post_ids: z.array(z.string()),
});

export const reportOutputSchema = z.object({
  executive_summary: z.string(),
  top_opportunities: z.array(opportunitySchema).length(3),
  strongest_positioning_angle: z.string(),
  best_wedge: z.string(),
  pain_clusters: z.array(painClusterSchema),
  feature_gaps: z.array(featureGapSchema),
  pricing_pain: z.string(),
  switching_signals: z.array(switchingSignalSchema),
  voice_of_customer: z.array(z.string()),
  voice_of_customer_phrases: z.array(vocPhraseSchema).optional(),
  competitor_weaknesses: z.array(z.string()),
  product_opportunities: z.array(z.string()),
  positioning_angles: z.array(z.string()),
  next_actions: z.array(z.string()),
  sources: z.array(sourceSchema),
  extra_clusters: z.array(painClusterSchema).optional(),
  meta: z
    .object({
      pipeline_version: z.string(),
      model_tier: z.string().optional(),
      error: z.string().optional(),
      warnings: z.array(z.string()).optional(),
      last_raw: z.unknown().optional(),
      hint: z.string().optional(),
    })
    .optional(),
});

export type ReportOutput = z.infer<typeof reportOutputSchema>;
export type LegacyReportOutput = import("../types/index").PainReportOutput;

// Task 0.3 — Rewritten createReportInputSchema
export const createReportInputSchema = z.object({
  category: z.string().min(1),
  competitors: z.array(z.string().min(1)).min(1).max(5),
  target_audience: z.string().min(1),
  founder_goal: reportGoalSchema,
  website_url: z.string().url().optional(),
});
export type CreateReportInput = z.infer<typeof createReportInputSchema>;
