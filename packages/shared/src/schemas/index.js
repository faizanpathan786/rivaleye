import { z } from "zod";
// ─── Auth Schemas ─────────────────────────────────────────────────────────────
export const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    name: z.string().min(1).max(255),
});
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
// ─── Workspace Schemas ────────────────────────────────────────────────────────
export const createWorkspaceSchema = z.object({
    name: z.string().min(1).max(255),
});
// ─── Competitor Schemas ───────────────────────────────────────────────────────
export const createCompetitorSchema = z.object({
    name: z.string().min(1).max(255),
    website: z.string().url().optional(),
});
export const updateCompetitorSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    website: z.string().url().optional().nullable(),
    status: z.enum(["active", "paused", "archived"]).optional(),
});
// ─── Mention Query Schemas ────────────────────────────────────────────────────
export const mentionQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sentiment: z.enum(["positive", "negative", "neutral", "mixed"]).optional(),
    category: z
        .enum(["complaint", "praise", "feature_request", "comparison", "pricing", "ux", "performance", "support", "competitor_update", "other"])
        .optional(),
    since: z.string().datetime().optional(),
    switchIntent: z.coerce.boolean().optional(),
});
// ─── Lead Query Schemas ───────────────────────────────────────────────────────
export const leadQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
// ─── AI Classification Output Schema ─────────────────────────────────────────
export const classificationOutputSchema = z.object({
    mentionId: z.string(),
    sentiment: z.enum(["positive", "negative", "neutral", "mixed"]),
    category: z.enum([
        "complaint",
        "praise",
        "feature_request",
        "comparison",
        "pricing",
        "ux",
        "performance",
        "support",
        "competitor_update",
        "other",
    ]),
    switchIntent: z.boolean(),
    switchIntentTarget: z.string().nullable(),
    urgency: z.enum(["low", "medium", "high"]),
    competitorMentions: z.array(z.string()),
    summary: z.string().max(300),
    confidence: z.number().min(0).max(1),
    featureShipped: z.string().nullable(),
    relevanceScore: z.number().min(0).max(100),
});
export const classificationBatchOutputSchema = z.array(classificationOutputSchema);
// ─── Reddit Discovery Schema ──────────────────────────────────────────────────
export const redditDiscoveryOutputSchema = z.object({
    subreddits: z.array(z.string().regex(/^[A-Za-z0-9_]+$/, "Invalid subreddit name")).min(1).max(10),
    searchTerms: z.array(z.string()).min(1).max(10),
});
