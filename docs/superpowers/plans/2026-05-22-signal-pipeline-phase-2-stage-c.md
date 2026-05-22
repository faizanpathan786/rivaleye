# Signal-Centric Pipeline — Phase 2 (Stage C Multi-Signal Clustering) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite Stage C from complaint-only clustering to multi-signal clustering — produce love / pain / gap / switch / pricing / feature / positioning clusters plus an evidence index — while Stage D and the final report keep working unchanged.

**Architecture:** The Stage C LLM emits a lean 7-cluster shape (`stageCMergeLlmSchema`). Code then enriches it — recomputes `frequency`/`source_spread`/`platforms`/`confidence`, builds `evidence_index` / `source_coverage` / `clustering_meta` — into the full `mergedSignalsSchema`. A pure `toLegacyMergedClusters()` derives the old `MergedClusters` so Stage D/E run untouched. `runStageCMerge()` returns `{ merged, mergedSignals }`; `run.ts` feeds `merged` to Stage D/E and checkpoints `{ ...merged, _signals: mergedSignals }`.

**Tech Stack:** TypeScript strict (`noUncheckedIndexedAccess`), Zod, Bun, `bun:test`, OpenRouter LLM client. Worker package: `packages/worker`.

**Source spec:** `docs/architecture/17-stage-c-multi-signal-clustering-plan.md`; design context `docs/architecture/15-signal-centric-pipeline-redesign.md` §5.

---

## File Map

**Create:**
- `packages/worker/src/pipeline/signal-cluster-adapters.ts` — `enrichMergedSignals()`, `toLegacyMergedClusters()`, `computeClusterStats()`, `buildEvidenceIndex()`, `computeSourceCoverage()`
- `packages/worker/src/pipeline/signal-cluster-adapters.test.ts`
- `packages/worker/src/prompts/cross/merge-signals.ts` — `buildSignalMerge()`, the multi-signal merge prompt
- `packages/worker/src/prompts/cross/merge-signals.test.ts`

**Modify:**
- `packages/worker/src/prompts/shared.ts` — add cluster + merged-signals schemas (keep `mergedClustersSchema`)
- `packages/worker/src/prompts/shared.test.ts` — add `mergedSignalsSchema` tests
- `packages/worker/src/pipeline/stage-c-merge.ts` — new LLM call + enrichment + dual return
- `packages/worker/src/pipeline/stage-c-merge.test.ts` — rewrite for the new return shape
- `packages/worker/src/pipeline/run.ts` — read `_signals`, pass to new Stage C, checkpoint both

**Scope guard:** Do NOT touch `stage-d-synth.ts`, `stage-e-refine.ts`, `prompts/cross/synth.ts`, `prompts/cross/refine.ts`, `persist.ts`, the DB schema, the API, or the web app.

---

## Execution Waves

- **Wave 1:** Task 1 (schemas).
- **Wave 2 (parallel ×2):** Task 2 (adapters/helpers — needs T1), Task 3 (merge prompt — needs T1).
- **Wave 3:** Task 4 (Stage C runner — needs T1–T3).
- **Wave 4:** Task 5 (run.ts — needs T4).
- **Wave 5:** Task 6 (verification).

Implementer subagents must NOT run `git commit` — the controller commits after review.

---

## Task 1: Add multi-signal cluster schemas to `shared.ts`

**Files:** Modify `packages/worker/src/prompts/shared.ts`, `packages/worker/src/prompts/shared.test.ts`.

- [ ] **Step 1: Write the failing test**

Append to `packages/worker/src/prompts/shared.test.ts`:

```typescript
import { mergedSignalsSchema, stageCMergeLlmSchema } from "./shared";

describe("mergedSignalsSchema", () => {
  it("parses a minimal valid merged-signals object", () => {
    const parsed = mergedSignalsSchema.parse({
      love_clusters: [],
      pain_clusters: [],
      gap_clusters: [],
      switch_clusters: [],
      pricing_clusters: [],
      feature_clusters: [],
      positioning_clusters: [],
      evidence_index: [],
      voice_top: { positive: [], negative: [] },
      cross_platform_themes: [],
      source_coverage: [],
      clustering_meta: {
        total_input_signals: 0,
        total_output_clusters: 0,
        model: "test",
        generated_at: "2026-05-22T00:00:00.000Z",
      },
    });
    expect(parsed.love_clusters).toEqual([]);
  });

  it("parses a love cluster and a switch cluster with their type-specific fields", () => {
    const parsed = mergedSignalsSchema.parse({
      love_clusters: [
        {
          id: "love-fast-setup",
          title: "Fast setup",
          summary: "Users praise quick onboarding.",
          signal_type: "love",
          strength_or_severity: 0.7,
          evidence_ids: ["reddit:1"],
          representative_quotes: [{ author: "u/x", text: "up in minutes", evidence_id: "reddit:1" }],
          role_relevance: ["founder", "product"],
        },
      ],
      pain_clusters: [],
      gap_clusters: [],
      switch_clusters: [
        {
          id: "switch-plivo",
          title: "Eyeing Plivo",
          summary: "Users pricing out Plivo.",
          signal_type: "switch",
          strength_or_severity: 0.6,
          evidence_ids: ["reddit:2"],
          representative_quotes: [],
          role_relevance: ["growth"],
          direction: "outbound",
          competitor: "Plivo",
          alternatives: ["Plivo", "Voco"],
          urgency: "high",
        },
      ],
      pricing_clusters: [],
      feature_clusters: [],
      positioning_clusters: [],
      evidence_index: [],
      voice_top: { positive: [], negative: [] },
      cross_platform_themes: [],
      source_coverage: [],
      clustering_meta: {
        total_input_signals: 2, total_output_clusters: 2, model: "t", generated_at: "2026-05-22T00:00:00.000Z",
      },
    });
    expect(parsed.love_clusters[0]?.frequency).toBe(0);
    expect(parsed.switch_clusters[0]?.urgency).toBe("high");
  });
});

describe("stageCMergeLlmSchema", () => {
  it("parses the lean LLM output (7 cluster arrays + voice_top + themes)", () => {
    const parsed = stageCMergeLlmSchema.parse({
      love_clusters: [],
      pain_clusters: [],
      gap_clusters: [],
      switch_clusters: [],
      pricing_clusters: [],
      feature_clusters: [],
      positioning_clusters: [],
      voice_top: { positive: [], negative: [] },
      cross_platform_themes: [],
    });
    expect(parsed.feature_clusters).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `cd packages/worker && bun test src/prompts/shared.test.ts`
Expected: FAIL — `mergedSignalsSchema` / `stageCMergeLlmSchema` not exported.

- [ ] **Step 3: Add the schemas to `shared.ts`**

In `packages/worker/src/prompts/shared.ts`, after the existing `mergedClustersSchema` block, add:

```typescript
export const signalClusterTypeSchema = z.enum([
  "love", "pain", "gap", "switch", "pricing", "feature", "positioning",
]);
export const roleRelevanceSchema = z.enum(["founder", "product", "marketing", "growth"]);

export const clusterQuoteSchema = z.object({
  author: z.string(),
  text: z.string().min(1),
  evidence_id: z.string(),
});

export const signalClusterBaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  signal_type: signalClusterTypeSchema,
  frequency: z.number().int().nonnegative().default(0),
  source_spread: z.number().int().nonnegative().default(0),
  platforms: z.array(platformIdSchema).default([]),
  confidence: z.number().min(0).max(1).default(0),
  strength_or_severity: z.number().min(0).max(1),
  evidence_ids: z.array(z.string()).default([]),
  representative_quotes: z.array(clusterQuoteSchema).default([]),
  related_signal_ids: z.array(z.string()).default([]),
  role_relevance: z.array(roleRelevanceSchema).default([]),
});

export const loveClusterSchema = signalClusterBaseSchema;
export const painClusterSchema = signalClusterBaseSchema.extend({
  affected_segment: z.string().nullable().default(null),
  opportunity_implication: z.string().nullable().default(null),
});
export const gapClusterSchema = signalClusterBaseSchema.extend({
  workaround: z.string().nullable().default(null),
  product_opportunity: z.string().nullable().default(null),
});
export const switchClusterSchema = signalClusterBaseSchema.extend({
  direction: switchingDirectionSchema,
  competitor: z.string().nullable().default(null),
  alternatives: z.array(z.string()).default([]),
  urgency: z.enum(["low", "medium", "high"]).default("low"),
});
export const pricingClusterSchema = signalClusterBaseSchema.extend({
  tier_label: z.string().nullable().default(null),
  quoted_prices: z.array(z.string()).default([]),
  affected_segment: z.string().nullable().default(null),
});
export const featureClusterSchema = signalClusterBaseSchema.extend({
  feature_name: z.string().min(1),
  perception: z.enum(["loved", "mixed", "criticized"]),
  product_lesson: z.string().nullable().default(null),
});
export const positioningClusterSchema = signalClusterBaseSchema.extend({
  angle: z.string().min(1),
  against: z.string().nullable().default(null),
  promise_vs_reality: z.string().nullable().default(null),
});

export const evidenceIndexItemSchema = z.object({
  evidence_id: z.string(),
  source: platformIdSchema,
  text: z.string(),
  author: z.string().nullable().default(null),
  source_url: z.string().nullable().default(null),
  source_date: z.string().nullable().default(null),
  related_signal_ids: z.array(z.string()).default([]),
  related_cluster_ids: z.array(z.string()).default([]),
  sentiment: z.number().min(-1).max(1).nullable().default(null),
  confidence: z.number().min(0).max(1).default(0),
});

const voiceTopSchema = z.object({
  positive: z.array(z.object({ word: z.string(), count: z.number().int().nonnegative() })).default([]),
  negative: z.array(z.object({ word: z.string(), count: z.number().int().nonnegative() })).default([]),
});
const crossPlatformThemeSchema = z.object({
  theme: z.string(),
  signal_type: signalClusterTypeSchema,
  platforms: z.array(platformIdSchema),
  weight: z.number().min(0).max(1),
});

/** What the Stage C LLM returns — the seven cluster arrays plus voice/themes.
 *  Code-computed fields (frequency, source_spread, platforms, confidence) carry
 *  schema defaults here and are overwritten during enrichment. */
export const stageCMergeLlmSchema = z.object({
  love_clusters: z.array(loveClusterSchema).default([]),
  pain_clusters: z.array(painClusterSchema).default([]),
  gap_clusters: z.array(gapClusterSchema).default([]),
  switch_clusters: z.array(switchClusterSchema).default([]),
  pricing_clusters: z.array(pricingClusterSchema).default([]),
  feature_clusters: z.array(featureClusterSchema).default([]),
  positioning_clusters: z.array(positioningClusterSchema).default([]),
  voice_top: voiceTopSchema,
  cross_platform_themes: z.array(crossPlatformThemeSchema).default([]),
});

/** The full enriched Stage C output — LLM clusters + code-built index/coverage/meta. */
export const mergedSignalsSchema = stageCMergeLlmSchema.extend({
  evidence_index: z.array(evidenceIndexItemSchema).default([]),
  source_coverage: z
    .array(z.object({
      platform: platformIdSchema,
      signal_count: z.number().int().nonnegative(),
      contributed: z.boolean(),
    }))
    .default([]),
  clustering_meta: z.object({
    total_input_signals: z.number().int().nonnegative(),
    total_output_clusters: z.number().int().nonnegative(),
    model: z.string(),
    generated_at: z.string(),
  }),
});
```

Then add to the type-export block:

```typescript
export type SignalClusterBase = z.infer<typeof signalClusterBaseSchema>;
export type LoveCluster = z.infer<typeof loveClusterSchema>;
export type PainCluster = z.infer<typeof painClusterSchema>;
export type GapCluster = z.infer<typeof gapClusterSchema>;
export type SwitchCluster = z.infer<typeof switchClusterSchema>;
export type PricingCluster = z.infer<typeof pricingClusterSchema>;
export type FeatureCluster = z.infer<typeof featureClusterSchema>;
export type PositioningCluster = z.infer<typeof positioningClusterSchema>;
export type EvidenceIndexItem = z.infer<typeof evidenceIndexItemSchema>;
export type StageCMergeLlmOutput = z.infer<typeof stageCMergeLlmSchema>;
export type MergedSignals = z.infer<typeof mergedSignalsSchema>;
```

Do not modify `mergedClustersSchema` or any other existing schema.

- [ ] **Step 4: Run test — verify it passes**

Run: `cd packages/worker && bun test src/prompts/shared.test.ts`
Expected: PASS for the new `mergedSignalsSchema` / `stageCMergeLlmSchema` tests (the pre-existing `accepts a minimal valid SynthOutput` failure remains, out of scope).

- [ ] **Step 5: Type-check**

Run: `cd packages/worker && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/worker/src/prompts/shared.ts packages/worker/src/prompts/shared.test.ts
git commit -m "feat(worker): add multi-signal cluster schemas for Stage C"
```

---

## Task 2: Create the Stage C adapters + enrichment helpers

**Files:** Create `packages/worker/src/pipeline/signal-cluster-adapters.ts`, `packages/worker/src/pipeline/signal-cluster-adapters.test.ts`.

These are pure functions: enrich the lean LLM output into `MergedSignals`, and derive the legacy `MergedClusters`.

- [ ] **Step 1: Write the failing test**

Create `packages/worker/src/pipeline/signal-cluster-adapters.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { enrichMergedSignals, toLegacyMergedClusters } from "./signal-cluster-adapters";
import { mergedClustersSchema } from "../prompts/shared";
import type { StageCMergeLlmOutput, EvidenceIndexItem } from "../prompts/shared";

const emptyLlm: StageCMergeLlmOutput = {
  love_clusters: [], pain_clusters: [], gap_clusters: [], switch_clusters: [],
  pricing_clusters: [], feature_clusters: [], positioning_clusters: [],
  voice_top: { positive: [], negative: [] }, cross_platform_themes: [],
};

function painCluster(over: Record<string, unknown> = {}) {
  return {
    id: "pain-x", title: "Sync breaks", summary: "Sync fails daily.",
    signal_type: "pain" as const, frequency: 0, source_spread: 0, platforms: [],
    confidence: 0, strength_or_severity: 0.8, evidence_ids: ["reddit:1", "appstore:9"],
    representative_quotes: [{ author: "u/x", text: "sync broke again", evidence_id: "reddit:1" }],
    related_signal_ids: [], role_relevance: ["product" as const],
    affected_segment: null, opportunity_implication: null, ...over,
  };
}

describe("enrichMergedSignals", () => {
  const evidencePlatform = new Map<string, "reddit" | "appstore">([
    ["reddit:1", "reddit"], ["appstore:9", "appstore"],
  ]);
  const evidenceIndex: EvidenceIndexItem[] = [];

  it("recomputes frequency, source_spread and platforms from evidence_ids", () => {
    const llm: StageCMergeLlmOutput = { ...emptyLlm, pain_clusters: [painCluster()] };
    const merged = enrichMergedSignals(llm, {
      evidencePlatform, evidenceIndex, totalInputSignals: 2, model: "m",
    });
    const c = merged.pain_clusters[0]!;
    expect(c.frequency).toBe(2);
    expect(c.source_spread).toBe(2);
    expect(c.platforms.sort()).toEqual(["appstore", "reddit"]);
    expect(c.confidence).toBeGreaterThan(0);
  });

  it("fills evidence_index, source_coverage and clustering_meta", () => {
    const llm: StageCMergeLlmOutput = { ...emptyLlm, pain_clusters: [painCluster()] };
    const merged = enrichMergedSignals(llm, {
      evidencePlatform,
      evidenceIndex: [{
        evidence_id: "reddit:1", source: "reddit", text: "sync broke", author: null,
        source_url: null, source_date: null, related_signal_ids: [], related_cluster_ids: [],
        sentiment: null, confidence: 0,
      }],
      totalInputSignals: 2, model: "m",
    });
    expect(merged.evidence_index.length).toBe(1);
    expect(merged.clustering_meta.total_output_clusters).toBe(1);
    expect(merged.clustering_meta.model).toBe("m");
  });
});

describe("toLegacyMergedClusters", () => {
  it("maps pain_clusters to complaint_clusters and gap_clusters to feature_clusters", () => {
    const merged = enrichMergedSignals(
      {
        ...emptyLlm,
        pain_clusters: [painCluster()],
        gap_clusters: [{
          id: "gap-recurring", title: "Recurring tasks", summary: "Users want recurring tasks.",
          signal_type: "gap", frequency: 0, source_spread: 0, platforms: [], confidence: 0,
          strength_or_severity: 0.6, evidence_ids: ["reddit:1"], representative_quotes: [],
          related_signal_ids: [], role_relevance: ["product"], workaround: null, product_opportunity: null,
        }],
      },
      { evidencePlatform: new Map([["reddit:1", "reddit"], ["appstore:9", "appstore"]]),
        evidenceIndex: [], totalInputSignals: 3, model: "m" },
    );
    const legacy = toLegacyMergedClusters(merged);
    expect(legacy.complaint_clusters[0]?.title).toBe("Sync breaks");
    expect(legacy.complaint_clusters[0]?.severity).toBe(0.8);
    expect(legacy.complaint_clusters[0]?.sample_quote).toBe("sync broke again");
    expect(legacy.feature_clusters[0]?.feature).toBe("Recurring tasks");
  });

  it("produces a schema-valid legacy MergedClusters", () => {
    const merged = enrichMergedSignals(
      { ...emptyLlm, pain_clusters: [painCluster()] },
      { evidencePlatform: new Map([["reddit:1", "reddit"], ["appstore:9", "appstore"]]),
        evidenceIndex: [], totalInputSignals: 2, model: "m" },
    );
    expect(() => mergedClustersSchema.parse(toLegacyMergedClusters(merged))).not.toThrow();
  });

  it("switching_clusters share sums to ~1 across switch clusters", () => {
    const sw = (id: string, ev: string[]) => ({
      id, title: id, summary: "s", signal_type: "switch" as const, frequency: 0, source_spread: 0,
      platforms: [], confidence: 0, strength_or_severity: 0.5, evidence_ids: ev,
      representative_quotes: [], related_signal_ids: [], role_relevance: ["growth" as const],
      direction: "outbound" as const, competitor: "Plivo", alternatives: ["Plivo"], urgency: "low" as const,
    });
    const merged = enrichMergedSignals(
      { ...emptyLlm, switch_clusters: [sw("a", ["reddit:1"]), sw("b", ["appstore:9"])] },
      { evidencePlatform: new Map([["reddit:1", "reddit"], ["appstore:9", "appstore"]]),
        evidenceIndex: [], totalInputSignals: 2, model: "m" },
    );
    const legacy = toLegacyMergedClusters(merged);
    const total = legacy.switching_clusters.reduce((s, c) => s + c.share, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it("handles an empty merged-signals object", () => {
    const merged = enrichMergedSignals(emptyLlm, {
      evidencePlatform: new Map(), evidenceIndex: [], totalInputSignals: 0, model: "m",
    });
    const legacy = toLegacyMergedClusters(merged);
    expect(legacy.complaint_clusters).toEqual([]);
    expect(() => mergedClustersSchema.parse(legacy)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `cd packages/worker && bun test src/pipeline/signal-cluster-adapters.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `signal-cluster-adapters.ts`**

Create `packages/worker/src/pipeline/signal-cluster-adapters.ts`:

```typescript
import type { PlatformId } from "@rivaleye/scrapers";
import type {
  EvidenceIndexItem, MergedClusters, MergedSignals, SignalClusterBase, StageCMergeLlmOutput,
} from "../prompts/shared";

export interface EnrichContext {
  /** evidence_id → platform it came from. */
  evidencePlatform: Map<string, PlatformId>;
  /** the pre-built evidence index (see buildEvidenceIndex). */
  evidenceIndex: EvidenceIndexItem[];
  /** total raw signals fed into Stage C (for clustering_meta). */
  totalInputSignals: number;
  model: string;
}

/** Confidence: more evidence and wider platform spread => higher confidence. */
function clusterConfidence(frequency: number, sourceSpread: number): number {
  const freqScore = Math.min(frequency / 8, 1);     // 8+ mentions => full
  const spreadScore = Math.min(sourceSpread / 3, 1); // 3+ platforms => full
  return Math.round((freqScore * 0.6 + spreadScore * 0.4) * 100) / 100;
}

function withStats<T extends SignalClusterBase>(cluster: T, evidencePlatform: Map<string, PlatformId>): T {
  const platforms = [
    ...new Set(
      cluster.evidence_ids
        .map((id) => evidencePlatform.get(id))
        .filter((p): p is PlatformId => p !== undefined),
    ),
  ];
  const frequency = cluster.evidence_ids.length;
  const source_spread = platforms.length;
  return {
    ...cluster,
    frequency,
    source_spread,
    platforms,
    confidence: clusterConfidence(frequency, source_spread),
  };
}

/** Enrich the lean LLM output into the full MergedSignals: recompute per-cluster
 *  stats in code, attach the evidence index, source coverage and meta. */
export function enrichMergedSignals(
  llm: StageCMergeLlmOutput,
  ctx: EnrichContext,
): MergedSignals {
  const ep = ctx.evidencePlatform;
  const love_clusters = llm.love_clusters.map((c) => withStats(c, ep));
  const pain_clusters = llm.pain_clusters.map((c) => withStats(c, ep));
  const gap_clusters = llm.gap_clusters.map((c) => withStats(c, ep));
  const switch_clusters = llm.switch_clusters.map((c) => withStats(c, ep));
  const pricing_clusters = llm.pricing_clusters.map((c) => withStats(c, ep));
  const feature_clusters = llm.feature_clusters.map((c) => withStats(c, ep));
  const positioning_clusters = llm.positioning_clusters.map((c) => withStats(c, ep));

  const totalClusters =
    love_clusters.length + pain_clusters.length + gap_clusters.length +
    switch_clusters.length + pricing_clusters.length + feature_clusters.length +
    positioning_clusters.length;

  const source_coverage = computeSourceCoverage(ep);

  return {
    love_clusters,
    pain_clusters,
    gap_clusters,
    switch_clusters,
    pricing_clusters,
    feature_clusters,
    positioning_clusters,
    voice_top: llm.voice_top,
    cross_platform_themes: llm.cross_platform_themes,
    evidence_index: ctx.evidenceIndex,
    source_coverage,
    clustering_meta: {
      total_input_signals: ctx.totalInputSignals,
      total_output_clusters: totalClusters,
      model: ctx.model,
      generated_at: new Date().toISOString(),
    },
  };
}

export function computeSourceCoverage(
  evidencePlatform: Map<string, PlatformId>,
): MergedSignals["source_coverage"] {
  const counts = new Map<PlatformId, number>();
  for (const platform of evidencePlatform.values()) {
    counts.set(platform, (counts.get(platform) ?? 0) + 1);
  }
  return [...counts.entries()].map(([platform, signal_count]) => ({
    platform,
    signal_count,
    contributed: signal_count > 0,
  }));
}

/** Derive the legacy MergedClusters so Stage D/E keep working unchanged. */
export function toLegacyMergedClusters(m: MergedSignals): MergedClusters {
  const switchTotal = m.switch_clusters.reduce((s, c) => s + c.frequency, 0);
  return {
    complaint_clusters: m.pain_clusters.map((c) => ({
      title: c.title,
      summary: c.summary,
      severity: c.strength_or_severity,
      platforms: c.platforms,
      evidence_ids: c.evidence_ids,
      sample_quote: c.representative_quotes[0]?.text ?? null,
    })),
    feature_clusters: m.gap_clusters.map((c) => ({
      feature: c.title,
      demand_score: c.strength_or_severity,
      platforms: c.platforms,
      evidence_ids: c.evidence_ids,
    })),
    pricing_clusters: m.pricing_clusters.map((c) => ({
      tier_label: c.tier_label ?? "General",
      pain: c.strength_or_severity,
      note: c.summary,
      platforms: c.platforms,
      sample_quotes: c.representative_quotes.map((q) => ({ who: q.author, text: q.text })),
    })),
    switching_clusters: m.switch_clusters.map((c) => ({
      direction: c.direction,
      competitor: c.competitor ?? c.alternatives.find((a) => a.length > 0) ?? c.title,
      count: c.frequency,
      share: switchTotal > 0 ? Math.round((c.frequency / switchTotal) * 100) / 100 : 0,
      platforms: c.platforms,
    })),
    voice_top: m.voice_top,
    cross_platform_themes: m.cross_platform_themes.map((t) => ({
      theme: t.theme,
      platforms: t.platforms,
      weight: t.weight,
    })),
  };
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `cd packages/worker && bun test src/pipeline/signal-cluster-adapters.test.ts`
Expected: PASS — all tests pass.

- [ ] **Step 5: Type-check**

Run: `cd packages/worker && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/worker/src/pipeline/signal-cluster-adapters.ts packages/worker/src/pipeline/signal-cluster-adapters.test.ts
git commit -m "feat(worker): add Stage C signal-cluster enrichment + legacy adapter"
```

---

## Task 3: Create the multi-signal merge prompt

**Files:** Create `packages/worker/src/prompts/cross/merge-signals.ts`, `packages/worker/src/prompts/cross/merge-signals.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `packages/worker/src/prompts/cross/merge-signals.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { buildSignalMerge } from "./merge-signals";
import { stageCMergeLlmSchema } from "../shared";
import { emptyStageAExtract } from "../../pipeline/signal-adapters";

const ctx = {
  reportId: "r1", competitor: "Twilio", category: "Messaging",
  audience: null, goal: "find_user_pain",
};

describe("buildSignalMerge", () => {
  it("returns the lean Stage C LLM schema", () => {
    const built = buildSignalMerge({ ctx, briefs: [], signalExtracts: [] });
    expect(built.schema).toBe(stageCMergeLlmSchema);
  });

  it("system prompt requires all seven cluster types and forbids the complaint cap", () => {
    const built = buildSignalMerge({ ctx, briefs: [], signalExtracts: [] });
    for (const k of [
      "love_clusters", "pain_clusters", "gap_clusters", "switch_clusters",
      "pricing_clusters", "feature_clusters", "positioning_clusters",
    ]) {
      expect(built.system).toContain(k);
    }
    expect(built.system).toContain("love and pain EQUAL");
  });

  it("user message includes the competitor and the per-platform signal extracts", () => {
    const built = buildSignalMerge({
      ctx,
      briefs: [],
      signalExtracts: [{ platform: "reddit", extract: emptyStageAExtract() }],
    });
    expect(built.user).toContain("Twilio");
    expect(built.user).toContain("reddit");
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `cd packages/worker && bun test src/prompts/cross/merge-signals.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `merge-signals.ts`**

Create `packages/worker/src/prompts/cross/merge-signals.ts`:

```typescript
import { stageCMergeLlmSchema } from "../shared";
import type { PipelineCtx, PlatformBrief, StageAExtract } from "../shared";
import type { PlatformId } from "@rivaleye/scrapers";

const SYSTEM = `You are a cross-platform competitor-perception analyst. You receive per-platform signal extracts and merge them into unified, deduplicated clusters — one set of clusters per signal type.

RivalEye captures what users really think about a competitor. Give love and pain EQUAL weight — love is a first-class signal, not an afterthought.

Return ONE JSON object with EXACTLY these keys (all required, never omit):
{
  "love_clusters":        [Cluster],
  "pain_clusters":        [Cluster + affected_segment, opportunity_implication],
  "gap_clusters":         [Cluster + workaround, product_opportunity],
  "switch_clusters":      [Cluster + direction:"inbound|outbound", competitor, alternatives[], urgency:"low|medium|high"],
  "pricing_clusters":     [Cluster + tier_label, quoted_prices[], affected_segment],
  "feature_clusters":     [Cluster + feature_name, perception:"loved|mixed|criticized", product_lesson],
  "positioning_clusters": [Cluster + angle, against, promise_vs_reality],
  "voice_top":            { "positive":[{word,count}], "negative":[{word,count}] },
  "cross_platform_themes":[{ theme, signal_type, platforms[], weight }]
}

Every Cluster has: id (kebab-slug, unique), title, summary, signal_type, strength_or_severity (0..1),
evidence_ids (string[]), representative_quotes ([{author,text,evidence_id}]), related_signal_ids (string[]),
role_relevance (subset of ["founder","product","marketing","growth"]).

Rules:
1. Collapse semantically equivalent signals of the SAME type into one cluster; no duplicates.
   Do NOT cap the number of clusters — produce as many distinct clusters as the evidence supports,
   for EVERY signal type. There is no special target for pain.
2. love_clusters: what users praise, why they choose/stay, competitor strengths, stickiness reasons.
3. pain_clusters: repeated frustrations; affected_segment = who is hit; opportunity_implication = the opening.
4. gap_clusters: requested features / missing workflows; workaround = how users cope today.
5. switch_clusters: alternative-seeking / migration / churn intent; name the competitor and alternatives.
6. pricing_clusters: pricing complaints, value perception, plan-limit issues; quoted_prices verbatim.
7. feature_clusters: named features and how they land (loved | mixed | criticized) + a product_lesson.
8. positioning_clusters: repeated user language, category perception, objections, comparison framing.
9. evidence_ids: use ONLY the ids present in the input extracts. Include ALL member ids — never truncate.
   The array length is the true mention count.
10. strength_or_severity: 0 (weak) to 1 (intense). role_relevance: which ICP dashboards each cluster serves.
11. related_signal_ids: cross-link clusters that are causally related (e.g. a pain to the gap that fixes it).
12. Never invent data; omit rather than fabricate. Return ONLY the JSON object. No prose, no markdown fences.`;

export interface SignalMergeInput {
  ctx: PipelineCtx;
  briefs: PlatformBrief[];
  signalExtracts: Array<{ platform: PlatformId; extract: StageAExtract }>;
}

export function buildSignalMerge(input: SignalMergeInput): {
  system: string;
  user: string;
  schema: typeof stageCMergeLlmSchema;
} {
  const extractsBlock = input.signalExtracts
    .map((s) => `### platform=${s.platform}\n${JSON.stringify(s.extract, null, 2)}`)
    .join("\n\n");

  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Goal: ${input.ctx.goal}

Platform briefs:
${JSON.stringify(input.briefs, null, 2)}

Per-platform signal extracts:
${extractsBlock}

Merge into unified multi-signal clusters. Return the JSON object now.`;

  return { system: SYSTEM, user, schema: stageCMergeLlmSchema };
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `cd packages/worker && bun test src/prompts/cross/merge-signals.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/prompts/cross/merge-signals.ts packages/worker/src/prompts/cross/merge-signals.test.ts
git commit -m "feat(worker): add multi-signal Stage C merge prompt"
```

---

## Task 4: Rewrite the Stage C runner

**Files:** Modify `packages/worker/src/pipeline/stage-c-merge.ts`, `packages/worker/src/pipeline/stage-c-merge.test.ts`.

`runStageCMerge` now: builds an `evidence_id → platform` map and an `evidence_index` from the input signal extracts, calls the new prompt, enriches, and returns both `mergedSignals` and the legacy `merged`.

- [ ] **Step 1: Replace the test file**

Replace the entire contents of `packages/worker/src/pipeline/stage-c-merge.test.ts` with:

```typescript
import { describe, expect, it } from "bun:test";
import { runStageCMerge } from "./stage-c-merge";
import { emptyStageAExtract } from "./signal-adapters";
import { mergedClustersSchema } from "../prompts/shared";
import type { OpenRouterClient } from "@rivaleye/shared";

describe("runStageCMerge", () => {
  it("returns both mergedSignals and a legacy-valid merged, and enriches cluster stats", async () => {
    const fakeLlm = {
      complete: async () => ({
        parsed: {
          love_clusters: [],
          pain_clusters: [{
            id: "pain-sync", title: "Sync breaks", summary: "Sync fails daily.",
            signal_type: "pain", strength_or_severity: 0.8, evidence_ids: ["reddit:1"],
            representative_quotes: [{ author: "u/x", text: "sync broke", evidence_id: "reddit:1" }],
            related_signal_ids: [], role_relevance: ["product"],
            affected_segment: null, opportunity_implication: null,
          }],
          gap_clusters: [], switch_clusters: [], pricing_clusters: [],
          feature_clusters: [], positioning_clusters: [],
          voice_top: { positive: [], negative: [] }, cross_platform_themes: [],
        },
        raw: "{}",
        usage: { promptTokens: 40, completionTokens: 20 },
        model: "test-model",
      }),
    } as unknown as OpenRouterClient;

    const redditExtract = emptyStageAExtract();
    redditExtract.pain_signals = [{
      title: "Sync breaks", summary: "Sync fails.", sentiment: -0.8, strength_or_severity: 0.8,
      evidence_ids: ["reddit:1"], representative_quotes: [], related_features: [], user_segment: null,
    }];

    const res = await runStageCMerge({
      llm: fakeLlm,
      ctx: { reportId: "r1", competitor: "Notion", category: "productivity", audience: null, goal: "find_user_pain" },
      briefs: [],
      signalExtracts: [{ platform: "reddit", extract: redditExtract }],
    });

    expect(res.mergedSignals.pain_clusters[0]?.frequency).toBe(1);
    expect(res.mergedSignals.pain_clusters[0]?.platforms).toEqual(["reddit"]);
    expect(res.merged.complaint_clusters[0]?.title).toBe("Sync breaks");
    expect(() => mergedClustersSchema.parse(res.merged)).not.toThrow();
    expect(res.usage.promptTokens).toBe(40);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `cd packages/worker && bun test src/pipeline/stage-c-merge.test.ts`
Expected: FAIL — `runStageCMerge` does not accept `signalExtracts` / does not return `mergedSignals`.

- [ ] **Step 3: Rewrite `stage-c-merge.ts`**

Replace the entire contents of `packages/worker/src/pipeline/stage-c-merge.ts` with:

```typescript
import type { PlatformId } from "@rivaleye/scrapers";
import type { LlmCallOptions, OpenRouterClient } from "@rivaleye/shared";
import type {
  EvidenceIndexItem, MergedClusters, MergedSignals, PipelineCtx, PlatformBrief, StageAExtract,
  StageCMergeLlmOutput,
} from "../prompts/shared";
import { buildSignalMerge } from "../prompts/cross/merge-signals";
import { enrichMergedSignals, toLegacyMergedClusters } from "./signal-cluster-adapters";
import { PipelineError } from "./errors";

export interface StageCInput {
  llm: OpenRouterClient;
  ctx: PipelineCtx;
  briefs: PlatformBrief[];
  signalExtracts: Array<{ platform: PlatformId; extract: StageAExtract }>;
}

export interface StageCOutput {
  merged: MergedClusters;
  mergedSignals: MergedSignals;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

/** Build evidence_id -> platform from the per-platform signal extracts. */
function buildEvidencePlatformMap(
  signalExtracts: StageCInput["signalExtracts"],
): Map<string, PlatformId> {
  const map = new Map<string, PlatformId>();
  for (const { platform, extract } of signalExtracts) {
    const groups = [
      extract.love_signals, extract.pain_signals, extract.gap_signals,
      extract.switch_signals, extract.pricing_signals, extract.feature_signals,
      extract.positioning_signals,
    ];
    for (const group of groups) {
      for (const signal of group) {
        for (const id of signal.evidence_ids) map.set(id, platform);
      }
    }
    for (const q of extract.evidence_quotes) map.set(q.evidence_id, platform);
  }
  return map;
}

/** Build the evidence index from every platform's evidence_quotes. */
function buildEvidenceIndex(
  signalExtracts: StageCInput["signalExtracts"],
): EvidenceIndexItem[] {
  const byId = new Map<string, EvidenceIndexItem>();
  for (const { platform, extract } of signalExtracts) {
    for (const q of extract.evidence_quotes) {
      if (byId.has(q.evidence_id)) continue;
      byId.set(q.evidence_id, {
        evidence_id: q.evidence_id,
        source: platform,
        text: q.text,
        author: q.author || null,
        source_url: null,
        source_date: null,
        related_signal_ids: [],
        related_cluster_ids: [],
        sentiment: q.sentiment,
        confidence: 0,
      });
    }
  }
  return [...byId.values()];
}

function countSignals(extract: StageAExtract): number {
  return (
    extract.love_signals.length + extract.pain_signals.length + extract.gap_signals.length +
    extract.switch_signals.length + extract.pricing_signals.length +
    extract.feature_signals.length + extract.positioning_signals.length
  );
}

export async function runStageCMerge(input: StageCInput, opts?: LlmCallOptions): Promise<StageCOutput> {
  const built = buildSignalMerge({
    ctx: input.ctx,
    briefs: input.briefs,
    signalExtracts: input.signalExtracts,
  });
  try {
    const res = await input.llm.complete(
      { system: built.system, user: built.user, schema: built.schema },
      opts,
    );
    const llmOutput = res.parsed as StageCMergeLlmOutput;
    const mergedSignals = enrichMergedSignals(llmOutput, {
      evidencePlatform: buildEvidencePlatformMap(input.signalExtracts),
      evidenceIndex: buildEvidenceIndex(input.signalExtracts),
      totalInputSignals: input.signalExtracts.reduce((s, x) => s + countSignals(x.extract), 0),
      model: res.model,
    });
    return {
      merged: toLegacyMergedClusters(mergedSignals),
      mergedSignals,
      usage: res.usage,
      model: res.model,
    };
  } catch (err) {
    throw new PipelineError("C", "merge failed", err);
  }
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `cd packages/worker && bun test src/pipeline/stage-c-merge.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `cd packages/worker && bunx tsc --noEmit`
Expected: errors only in `pipeline/run.ts` (it still calls the old `runStageCMerge` signature — fixed in Task 5). If errors appear elsewhere, stop and report.

- [ ] **Step 6: Commit**

```bash
git add packages/worker/src/pipeline/stage-c-merge.ts packages/worker/src/pipeline/stage-c-merge.test.ts
git commit -m "feat(worker): Stage C runner produces multi-signal clusters + legacy bridge"
```

---

## Task 5: Wire the new Stage C through `run.ts`

**Files:** Modify `packages/worker/src/pipeline/run.ts`.

`run.ts` must read the `_signals` (StageAExtract) off each brief row, pass the per-platform signal extracts to the new Stage C, and checkpoint `{ ...merged, _signals: mergedSignals }`. Stage D/E keep receiving the legacy `merged`.

- [ ] **Step 1: Update imports and the brief-loading block**

In `packages/worker/src/pipeline/run.ts`, add to the type imports from `../prompts/shared`: `StageAExtract`, `MergedSignals`. Add an import: `import type { PlatformId } from "@rivaleye/scrapers";`.

Replace the current `extracts` mapping block (the `briefRows.map` that strips `_signals`) with:

```typescript
  const briefs: PlatformBrief[] = briefRows.map((row) => row.summary as unknown as PlatformBrief);
  const signalExtracts: Array<{ platform: PlatformId; extract: StageAExtract }> = briefRows.map((row) => {
    const raw = row.extract as Record<string, unknown>;
    return {
      platform: row.platform as PlatformId,
      extract: (raw._signals ?? emptyStageAExtract()) as StageAExtract,
    };
  });
```

Add the import `import { emptyStageAExtract } from "./signal-adapters";` if not already present.

(The legacy `extracts: PlatformExtract[]` variable is no longer needed by Stage C. If Stage D's `runStageDSynth` still references `extracts`, keep a legacy `extracts` built the same way as before — `{ ...raw } minus _signals` — and pass it to Stage D unchanged. Verify against the current `runStageDSynth` call and preserve whatever it needs.)

- [ ] **Step 2: Update the Stage C call**

Replace the Stage C invocation. The current code calls `runStageCMerge({ llm, ctx, briefs, extracts }, LLM_OPTS_C)` and uses `resultC.merged`. Change to:

```typescript
    const resultC = await runStageCMerge({ llm, ctx, briefs, signalExtracts }, LLM_OPTS_C);
    await log(reportId, "info", "C", null, "stage C done", {
      promptTokens: resultC.usage.promptTokens,
      completionTokens: resultC.usage.completionTokens,
      loveClusters: resultC.mergedSignals.love_clusters.length,
      painClusters: resultC.mergedSignals.pain_clusters.length,
      gapClusters: resultC.mergedSignals.gap_clusters.length,
      switchClusters: resultC.mergedSignals.switch_clusters.length,
      pricingClusters: resultC.mergedSignals.pricing_clusters.length,
      featureClusters: resultC.mergedSignals.feature_clusters.length,
      positioningClusters: resultC.mergedSignals.positioning_clusters.length,
    });
    merged = resultC.merged;
    await saveCheckpoint(reportId, "C", { ...merged, _signals: resultC.mergedSignals } as unknown as Record<string, unknown>);
```

Keep the existing checkpoint-restore path: `merged = checkpoints.get("C") as unknown as MergedClusters` still works because the legacy fields remain top-level (the extra `_signals` key is ignored by the `as MergedClusters` cast and by Stage D/E).

- [ ] **Step 3: Type-check**

Run: `cd packages/worker && bunx tsc --noEmit`
Expected: no errors anywhere in the package.

- [ ] **Step 4: Run the full worker test suite**

Run: `cd packages/worker && bun test src/`
Expected: all tests pass except the known pre-existing failures (`accepts a minimal valid SynthOutput` and DB-integration tests that need `CONNECTION_STRING`). No NEW failures.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/pipeline/run.ts
git commit -m "feat(worker): wire multi-signal Stage C through run.ts, checkpoint both shapes"
```

---

## Task 6: Verification

**Files:** none.

- [ ] **Step 1:** `cd packages/worker && bunx tsc --noEmit` — clean.
- [ ] **Step 2:** `cd packages/worker && bun test src/` — only the known pre-existing failures.
- [ ] **Step 3 (live, recommended):** Run one real report end-to-end (`pnpm dev`, create a report in the web app). Confirm it reaches `completed` — proving Stage D still produces a full report from the adapter-derived `merged`.
- [ ] **Step 4 (live):** In Drizzle Studio, inspect the `C` row of `report_pipeline_checkpoints` — confirm `output` has the legacy `complaint_clusters` etc. at the top level AND a `_signals` key containing `love_clusters`, `pain_clusters`, … `positioning_clusters`, `evidence_index`.

---

## Self-Review

**Spec coverage** (against `17-stage-c-multi-signal-clustering-plan.md`): new `mergedSignalsSchema` with 7 cluster types + evidence_index + voice/themes/coverage/meta → Task 1. `toLegacyMergedClusters` (Option B) + code-side stat/evidence/coverage helpers → Task 2. Multi-signal merge prompt, no complaint cap, love=first-class → Task 3. Dual-return runner → Task 4. `run.ts` reads `_signals`, checkpoints both → Task 5. Stage D/E untouched — enforced by the scope guard and verified in Tasks 5–6.

**Type consistency:** `StageCMergeLlmOutput`, `MergedSignals`, `MergedClusters`, `enrichMergedSignals`, `toLegacyMergedClusters`, `buildSignalMerge`, `runStageCMerge`'s `{ merged, mergedSignals }` are defined in Tasks 1–4 and consumed with identical names in Tasks 4–5.

**Acceptance criteria** (from doc 17): all seven cluster types produced; love first-class; gap/switch richer; every cluster has `evidence_ids` + `role_relevance`; Stage D still runs via the adapter; tests cover all seven signal types; no dashboard/API/web work.
