import { z } from "zod";

// Stage 1 schema (clusters from LLM)
export const stage1Schema = z.object({
  clusters: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    evidence_post_ids: z.array(z.string()).min(1),
    voice_phrases: z.array(z.string()),
  })),
  voice_phrases: z.array(z.string()).optional(),
});

// Stage 2 schema (intensity + specificity ratings from LLM)
export const stage2Schema = z.object({
  scores: z.array(z.object({
    cluster_id: z.string(),
    intensity: z.number().int().min(1).max(5),
    specificity: z.number().int().min(1).max(5),
  })),
});

// Stage 3 schema (full report synthesis from LLM)
export const stage3Schema = z.object({
  executive_summary: z.string().min(10),
  top_opportunities: z.array(z.object({
    title: z.string(),
    description: z.string(),
    evidence_post_ids: z.array(z.string()),
    differentiation: z.number().min(0).max(100),
  })).min(1).max(5), // LLM gives us candidates; we pick top 3 after scoring
  strongest_positioning_angle: z.string(),
  best_wedge: z.string(),
  pain_clusters: z.array(z.object({
    id: z.string(),
    evidence_post_ids: z.array(z.string()),
  })),
  feature_gaps: z.array(z.object({
    title: z.string(),
    description: z.string(),
    evidence_post_ids: z.array(z.string()),
    priority: z.enum(["high", "medium", "low"]).optional(),
  })),
  pricing_pain: z.string(),
  switching_signals: z.array(z.object({
    signal: z.string(),
    evidence_post_ids: z.array(z.string()),
  })),
  voice_of_customer: z.array(z.string()),
  competitor_weaknesses: z.array(z.string()),
  product_opportunities: z.array(z.string()),
  positioning_angles: z.array(z.string()),
  next_actions: z.array(z.string()),
});

// Stage 4 schema (next actions from LLM)
export const stage4Schema = z.object({
  actions: z.array(z.object({
    action: z.string(),
    cluster_ids: z.array(z.string()).min(1),
    why: z.string(),
  })).min(3).max(7),
});

export type Stage1LlmOutput = z.infer<typeof stage1Schema>;
export type Stage2LlmOutput = z.infer<typeof stage2Schema>;
export type Stage3LlmOutput = z.infer<typeof stage3Schema>;
export type Stage4LlmOutput = z.infer<typeof stage4Schema>;
