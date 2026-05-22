# 17 — Stage C Multi-Signal Clustering Plan (Phase 2)

**Status:** Design proposal — not approved, not implemented.
**Date:** 2026-05-22
**Phase:** 2 of the signal-centric pipeline redesign (`15-signal-centric-pipeline-redesign.md` §9).
**Scope:** Rewrite Stage C from complaint-centric clustering to multi-signal clustering. Stage D and the final report must keep working unchanged. **No dashboard work.**

> Numbered `17-` because `16-dashboard-data-contracts.md` already exists. This document is the Phase 2 counterpart to `2026-05-22-signal-pipeline-phase-1-stage-a.md` (Phase 1).

---

## 1. Current Stage C input / output shape

### 1.1 Files

| File | Role |
|---|---|
| `packages/worker/src/prompts/cross/merge.ts` | Stage C system prompt + `buildMerge()` |
| `packages/worker/src/pipeline/stage-c-merge.ts` | `runStageCMerge()` — calls the LLM, returns `MergedClusters` |
| `packages/worker/src/prompts/shared.ts` | `mergedClustersSchema` (the Zod contract) |
| `packages/worker/src/pipeline/stage-c-merge.test.ts` | current tests |
| `packages/worker/src/pipeline/run.ts` | orchestrator — calls Stage C, checkpoints, feeds Stage D/E |

### 1.2 Input

`runStageCMerge({ llm, ctx, briefs, extracts })`:
- `briefs: PlatformBrief[]` — per-platform summaries (legacy shape; Phase 1 did not change Stage B).
- `extracts: PlatformExtract[]` — the **legacy** extract shape. `run.ts` builds these from `report_platform_briefs.extract`, stripping the `_signals` key (Phase 1's `run.ts` fix).

**Key fact:** the new Phase-1 signal data already exists — it is persisted at `report_platform_briefs.extract._signals` as a `StageAExtract` per platform. Stage C just isn't reading it yet.

### 1.3 Output — `mergedClustersSchema`

```
complaint_clusters:   [{ title, summary, severity, platforms[], evidence_ids[], sample_quote }]
feature_clusters:     [{ feature, demand_score, platforms[], evidence_ids[] }]
pricing_clusters:     [{ tier_label, pain, note, platforms[], sample_quotes[] }]
switching_clusters:   [{ direction, competitor, count, share, platforms[] }]
voice_top:            { positive[{word,count}], negative[{word,count}] }
cross_platform_themes:[{ theme, platforms[], weight }]
```

Complaint-centric: only `complaint_clusters` carries `summary` + `severity` + `sample_quote`. There is **no love cluster**. `parsed` is cast `as MergedClusters` with no post-processing — every number comes straight from the LLM.

---

## 2. What depends on the old Stage C output

Everything that consumes `MergedClusters` must keep receiving exactly that shape after Phase 2:

| Consumer | File | How it uses `MergedClusters` |
|---|---|---|
| Checkpoint | `run.ts` `saveCheckpoint(reportId,"C",merged)` | stores the object; on resume `checkpoints.get("C") as MergedClusters` |
| Stage D synth | `stage-d-synth.ts` `runStageDSynth({ merged, ... })` | `buildSynth` JSON-stringifies `merged` into the prompt |
| Stage D enrichment | `stage-d-synth.ts` `enrichSynthOutput()` | builds a map from `merged.complaint_clusters[].title → evidence_ids.length` |
| Stage E refine | `run.ts` `stripEvidenceIds(merged)` | maps over `merged.complaint_clusters` and `merged.feature_clusters` |
| Stage E refine | `refine.ts` `buildRefine({ merged })` | JSON-stringifies `merged` as "ground truth" |

So Phase 2 must guarantee: **`run.ts` still hands Stage D and Stage E a valid legacy `MergedClusters`.**

---

## 3. New Stage C output shape — `MergedSignals`

Stage C's LLM call emits a new schema, `mergedSignalsSchema`. Eleven top-level keys.

### 3.1 Shared `SignalCluster` base

Every cluster, regardless of signal type, shares this base:

```typescript
const signalClusterBaseSchema = z.object({
  id: z.string(),                          // kebab-slug, unique within the report
  title: z.string().min(1),
  summary: z.string().min(1),
  signal_type: z.enum(["love","pain","gap","switch","pricing","feature","positioning"]),
  frequency: z.number().int().nonnegative(),       // distinct source posts (= evidence_ids.length)
  source_spread: z.number().int().nonnegative(),   // count of distinct platforms
  platforms: z.array(platformIdSchema),
  confidence: z.number().min(0).max(1),
  strength_or_severity: z.number().min(0).max(1),
  evidence_ids: z.array(z.string()),               // ALL member evidence ids — never truncated
  representative_quotes: z.array(z.object({
    author: z.string(), text: z.string(), evidence_id: z.string(),
  })),
  related_signal_ids: z.array(z.string()).default([]),  // cross-links to other clusters
  role_relevance: z.array(z.enum(["founder","product","marketing","growth"])),
});
```

**Computed in code, not trusted from the LLM** (per `15-...md` §5.3): `frequency` (= `evidence_ids.length`), `source_spread` + `platforms` (derived from which platforms the evidence ids belong to), `confidence` (a function of frequency × source_spread × quote directness). The LLM produces `title`, `summary`, `evidence_ids`, `representative_quotes`, `strength_or_severity`, `role_relevance`, and the per-type fields below.

### 3.2 Per-type cluster extensions

| Cluster | Extends base with | Purpose |
|---|---|---|
| `love_clusters` | *(base only)* | what users praise, why they choose/stay, competitor strengths, stickiness reasons |
| `pain_clusters` | `affected_segment: string\|null`, `opportunity_implication: string\|null` | repeated frustrations, severity, who is hit, what the opening is |
| `gap_clusters` | `workaround: string\|null`, `product_opportunity: string\|null` | requested features, missing workflows, how users cope today, the build opportunity |
| `switch_clusters` | `direction: "inbound"\|"outbound"`, `competitor: string\|null`, `alternatives: string[]`, `urgency: "low"\|"medium"\|"high"` | alternative-seeking, migration/churn intent, named competitors |
| `pricing_clusters` | `tier_label: string\|null`, `quoted_prices: string[]`, `affected_segment: string\|null` | pricing complaints, value perception, free-plan/limit issues, verbatim prices |
| `feature_clusters` | `feature_name: string`, `perception: "loved"\|"mixed"\|"criticized"`, `product_lesson: string\|null` | named features and how they land |
| `positioning_clusters` | `angle: string`, `against: string\|null`, `promise_vs_reality: string\|null` | repeated language, category perception, objections, comparison framing |

### 3.3 The `evidence_index`

The deduplicated quote pool. Every cluster's `representative_quotes` and `evidence_ids` point into it.

```typescript
const evidenceIndexItemSchema = z.object({
  evidence_id: z.string(),
  source: platformIdSchema,                 // platform
  text: z.string(),
  author: z.string().nullable(),
  source_url: z.string().nullable(),
  source_date: z.string().nullable(),       // ISO; when available
  related_signal_ids: z.array(z.string()),
  related_cluster_ids: z.array(z.string()),
  sentiment: z.number().min(-1).max(1).nullable(),
  confidence: z.number().min(0).max(1),
});
```

`evidence_index` is assembled in **code** by joining the Phase-1 `evidence_quotes` from every platform's `StageAExtract` with the `mentions` table (for `source_url` / `source_date` / `author`). The LLM does not generate it.

### 3.4 Top-level `mergedSignalsSchema`

```
love_clusters:         LoveCluster[]
pain_clusters:         PainCluster[]
gap_clusters:          GapCluster[]
switch_clusters:       SwitchCluster[]
pricing_clusters:      PricingCluster[]
feature_clusters:      FeatureCluster[]
positioning_clusters:  PositioningCluster[]
evidence_index:        EvidenceIndexItem[]
voice_top:             { positive[{word,count}], negative[{word,count}] }
cross_platform_themes: [{ theme, signal_type, platforms[], weight }]
source_coverage:       [{ platform, signal_count, contributed: boolean }]   // code-computed
clustering_meta:       { total_input_signals, total_output_clusters, model, generated_at }  // code-computed
```

`voice_top` and `cross_platform_themes` are carried forward (the latter gains a `signal_type` field). `source_coverage` and `clustering_meta` are deterministic, computed in code.

---

## 4. Backward-compatibility strategy

The new Stage C must not break Stage D/E. Two options:

### Option A — LLM returns both new and legacy shapes
The Stage C prompt asks the LLM to emit `mergedSignalsSchema` **and** the six legacy `mergedClustersSchema` fields in the same call.
- **Cons:** the LLM fills ~16 cluster arrays, much of it duplicated data in two shapes; large output, higher token cost, high drift risk (the two representations disagree). This is exactly the failure mode Phase 1 rejected for Stage A (`15-...md` §3.3).

### Option B — LLM returns the new shape; a code adapter derives the legacy shape
The Stage C LLM emits only `mergedSignalsSchema`. A pure function `toLegacyMergedClusters(mergedSignals): MergedClusters` derives the old shape deterministically.
- **Pros:** one source of truth, no LLM duplication, cheaper, identical pattern to Phase 1's `toLegacyExtract()`. `15-...md` §5.4 already names this adapter (`toLegacyMerged()`).
- **Cons:** the adapter must be carefully mapped and tested — but it is pure and unit-testable.

### Recommendation — **Option B**

It mirrors the proven Phase 1 bridge, keeps the prompt focused, and is the only option consistent with "compute derived values in code, never duplicate them in the prompt."

**`toLegacyMergedClusters()` mapping:**

| Legacy field | Derived from | Field mapping |
|---|---|---|
| `complaint_clusters` | `pain_clusters` | `title`, `summary`, `severity`←`strength_or_severity`, `platforms`, `evidence_ids`, `sample_quote`←`representative_quotes[0]?.text ?? null` |
| `feature_clusters` | `gap_clusters` | `feature`←`title`, `demand_score`←`strength_or_severity`, `platforms`, `evidence_ids` |
| `pricing_clusters` | `pricing_clusters` (new) | `tier_label`, `pain`←`strength_or_severity`, `note`←`summary`, `platforms`, `sample_quotes`←`representative_quotes` mapped to `{who,text}` |
| `switching_clusters` | `switch_clusters` | `direction`, `competitor`←`competitor ?? alternatives[0] ?? title`, `count`←`frequency`, `share`, `platforms` |
| `voice_top` | `voice_top` (new) | carried through unchanged |
| `cross_platform_themes` | `cross_platform_themes` (new) | drop the new `signal_type` field |

> Note: legacy `feature_clusters` semantically means *feature demand* → it maps from new **`gap_clusters`**. The new **`feature_clusters`** (named features, loved/criticized) has no legacy equivalent and is simply not represented in the legacy shape — acceptable, since Stage D's `feature_gaps` only ever consumed demand.
> `switching_clusters[].share` has no direct new-field source; compute it in the adapter as `frequency / sum(frequency of switch_clusters)`.

---

## 5. How Stage D keeps working during the transition

`runStageCMerge()` returns **both** shapes, mirroring Phase 1's `runStageAExtractionStep` (`{ legacy, signals }`):

```typescript
interface StageCOutput {
  merged: MergedClusters;        // legacy — adapter-derived, for Stage D/E
  mergedSignals: MergedSignals;  // new — for Phase 3
  usage: ...; model: ...;
}
```

In `run.ts`:
- Stage D and Stage E continue to receive `merged` (the legacy `MergedClusters`) — **their code, prompts, and `stripEvidenceIds` are untouched.**
- The Stage C checkpoint stores `{ ...merged, _signals: mergedSignals }` — legacy fields stay at the top level so `checkpoints.get("C") as MergedClusters` keeps working on resume; the new clusters ride along under `_signals` for Phase 3 to consume. (Same nesting trick as Phase 1's `report_platform_briefs.extract`.)
- `run.ts` also changes its **input** assembly: today it strips `_signals` from `report_platform_briefs.extract`. Phase 2 reads `_signals` back out and passes the `StageAExtract[]` to the new merge. The legacy `extracts` build can be dropped from the Stage C path (the new merge does not consume it) but stays available if needed.

**Net:** Stage D, Stage E, `synth.ts`, `refine.ts`, `stage-d-synth.ts`, `stage-e-refine.ts` — zero changes in Phase 2.

---

## 6. Tests needed

New / updated tests (Bun `bun:test`, matching the existing style):

- **`signal-cluster-adapters.test.ts`** (new) — `toLegacyMergedClusters()`: each legacy field maps correctly; `switching_clusters[].share` sums to ~1; empty input → empty legacy shape; output validates against `mergedClustersSchema`.
- **`stage-c-merge.test.ts`** (rewritten) — `runStageCMerge` returns both `merged` and `mergedSignals`; the fake LLM returns the new shape; assert all seven cluster arrays are present and `merged` is a valid legacy shape.
- **Per-signal-type clustering** — `buildMerge` (or `buildSignalMerge`) system-prompt assertions: love clusters required when love signal exists; love/pain given equal weight; the 8–15-complaint cap is gone; evidence-ids-never-truncated rule applies to every cluster type. Test fixtures exercising love, pain, gap, switch, pricing, feature, and positioning clustering.
- **Code-computed fields** — `frequency`, `source_spread`, `platforms`, `confidence`, `source_coverage`, `clustering_meta` are computed deterministically and not taken from the LLM.
- **`evidence_index` assembly** — joining `evidence_quotes` with `mentions` produces correct `source_url`/`source_date`; dedup by `evidence_id`.
- **Regression** — an existing Stage D test still passes when fed `toLegacyMergedClusters()` output (proves the bridge).

Acceptance: tests cover love, pain, gap, switch, pricing, feature, and positioning clustering; every cluster has `evidence_ids` and `role_relevance`; existing Stage D tests stay green.

---

## 7. Exact files to change

**Create:**
- `packages/worker/src/pipeline/signal-cluster-adapters.ts` — `toLegacyMergedClusters()`, plus pure helpers `computeClusterStats()` (frequency/source_spread/platforms/confidence), `buildEvidenceIndex()`, `computeSourceCoverage()`.
- `packages/worker/src/pipeline/signal-cluster-adapters.test.ts` — adapter + helper tests.
- `packages/worker/src/prompts/cross/merge-signals.ts` — the new multi-signal merge prompt (`buildSignalMerge()`), OR rewrite `merge.ts` in place (decide at implementation time; a new file is cleaner and lets the old one be deleted in one step).

**Modify:**
- `packages/worker/src/prompts/shared.ts` — add `signalClusterBaseSchema`, the seven per-type cluster schemas, `evidenceIndexItemSchema`, `mergedSignalsSchema`, and inferred types. Keep `mergedClustersSchema` exported (Stage D still uses it).
- `packages/worker/src/pipeline/stage-c-merge.ts` — call the new prompt; parse `mergedSignalsSchema`; run the code-side stat/evidence/coverage computation; return `{ merged, mergedSignals, usage, model }`.
- `packages/worker/src/pipeline/run.ts` — read `_signals` from `report_platform_briefs.extract` and pass `StageAExtract[]` to the new Stage C; checkpoint `{ ...merged, _signals: mergedSignals }`; keep feeding `merged` to Stage D/E.
- `packages/worker/src/pipeline/stage-c-merge.test.ts` — rewrite for the new return shape.

**Do NOT touch:** `stage-d-synth.ts`, `stage-e-refine.ts`, `synth.ts`, `refine.ts`, `persist.ts`, any DB schema, the API, the web app.

---

## 8. Rollout order

1. **Schemas** — add `mergedSignalsSchema` + cluster schemas to `shared.ts`. Tests: schema parses/rejects.
2. **Adapter + helpers** — `signal-cluster-adapters.ts` (`toLegacyMergedClusters`, `computeClusterStats`, `buildEvidenceIndex`, `computeSourceCoverage`). Tests in isolation. (Independent of step 3 — parallelizable.)
3. **New merge prompt** — `merge-signals.ts` / `buildSignalMerge()`. Tests: per-signal-type prompt assertions.
4. **Stage C runner** — rewrite `stage-c-merge.ts` to use steps 1–3, return `{ merged, mergedSignals }`. Tests: rewritten `stage-c-merge.test.ts`.
5. **Orchestrator** — `run.ts`: read `_signals`, pass to new Stage C, checkpoint both. 
6. **Verify** — `tsc` clean; full worker test suite green (minus the known pre-existing failures); one live report run end-to-end to confirm Stage D still produces a complete report from adapter-derived `merged`.

Each step is committable on its own. Steps 1–3 are independent; 4 depends on 1–3; 5 depends on 4; 6 last.

---

## Acceptance criteria

- [ ] Stage C no longer treats pain as the only first-class signal — all seven cluster types are produced.
- [ ] `love_clusters` are first-class (own array, own `summary`/`strength`/`evidence`).
- [ ] `gap_clusters` and `switch_clusters` are richer than the old `feature_clusters`/`switching_clusters` (carry `workaround`/`product_opportunity` and `direction`/`competitor`/`alternatives`/`urgency`).
- [ ] Every cluster has non-empty-capable `evidence_ids` and a `role_relevance` array.
- [ ] Existing Stage D still runs and produces a complete report after Stage C changes (via `toLegacyMergedClusters()`).
- [ ] Tests cover love, pain, gap, switch, pricing, feature, and positioning clustering.
- [ ] No dashboard / `report_role_sections` / API / web work in this phase.
