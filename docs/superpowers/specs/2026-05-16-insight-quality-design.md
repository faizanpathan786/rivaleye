# Insight Quality Design — Reddit Pain Report

Date: 2026-05-16
Scope: design only. No code in this spec.
Status: proposed
Related: PRD §10 (report sections), §12 (goal conditioning), §13 (personality), §14 (UX), §21 (success signals)

This spec replaces the current single-prompt clustering in `packages/worker/src/jobs/generate-report.ts` with a staged, evidence-bound, goal-conditioned pipeline. Reddit is the only source. The goal is reports a founder would forward to a co-founder, not market research filler.

---

## 1. Pipeline stages — recommendation: multi-pass

### Single-pass (rejected as default)

One prompt asks the LLM for all 10 sections at once. Cheap (1 call), low latency. This is what the codebase does today. It fails on:

- **Shallow reasoning** — the model spends its budget on shape, not depth.
- **Hallucinated evidence** — quotes drift from real posts because the model isn't forced to anchor.
- **No scoring** — every cluster looks equally important, so the ranking is arbitrary.
- **Goal-blind** — same output regardless of `founder_goal`.

Keep single-pass as a fallback path only (see §9 quality gates → retry policy).

### Multi-pass (recommended)

Four stages, each with a narrow prompt and a narrow output schema. Each stage's output is the next stage's input. The model never sees the full posts after stage 1 — later stages reason over compressed, scored clusters.

| Stage | Input | Output | Model |
|---|---|---|---|
| 1 — Cluster | Up to 150 truncated posts (existing `MAX_POSTS=150`, `MAX_BODY_CHARS=800`) with synthetic per-post IDs `p001..p150` | `RawCluster[]` — theme name, description, evidence post_ids, raw quotes | `deepseek/deepseek-v4-flash:free` |
| 2 — Score | `RawCluster[]` plus per-post metadata (createdAt, score, numComments) — no body text | `ScoredCluster[]` — frequency, intensity, recency, specificity, composite painScore | `deepseek/deepseek-v4-flash:free` |
| 3 — Synthesize | Top N scored clusters + `founder_goal` + competitor/category | Report sections per PRD §10 (everything except `nextActions`) | `deepseek/deepseek-v4-flash:free` primary; optional `anthropic/claude-sonnet-4` for paid tier |
| 4 — Next actions | Stage 3 output + `founder_goal` | `nextActions[]` — opinionated, founder-language, tied to clusters by id | Same as stage 3 |

**Justification:**

- **Separation of concerns** — clustering is pattern recognition over text; scoring is arithmetic over metadata; synthesis is opinionated writing; next actions is goal-conditioned recommendation. Different system prompts and different validation gates.
- **Evidence integrity** — stage 1 is the only stage that sees raw post text. Every cluster must emit `evidence.post_ids[]`. Downstream stages cannot invent new claims without an existing cluster.id; the schema rejects them.
- **Goal conditioning works cleanly** — only stages 3 and 4 see `founder_goal`. The clustering pass is goal-agnostic, so the same scrape can power multiple reports with different goals later (caching opportunity, not in MVP).
- **Cheaper retries** — if stage 3 fails validation we retry just stage 3, not the whole pipeline. Stage 1 is the expensive one (largest prompt); we never re-pay it for synthesis bugs.

**Cost / latency:**

- 4 calls vs 2 today. Tokens-in roughly 1.4× because stages 2–4 see compressed JSON, not raw posts. Wall clock roughly 1.6× (sequential).
- Stage 1 is the only large prompt. Stages 2–4 are tiny.
- All four stages on free DeepSeek: $0. Bumping stage 3 only to Claude Sonnet via OpenRouter is the highest-leverage upgrade if quality is short. Note tradeoff: ~$0.003–$0.012 per report depending on token count, vs $0 free tier. Stage 3 is where prose quality matters; stages 1, 2, 4 can stay on the free model.

**Model bump recommendation:** keep all stages on `deepseek/deepseek-v4-flash:free` for MVP. Add a `LLM_QUALITY_TIER` env switch (`free` | `paid`) that swaps stage 3 to Claude Sonnet once a paid plan exists. Do not bump stage 1 — the gain on clustering is small and the token cost is large.

---

## 2. Pain intensity scoring

Done by stage 2. Inputs are stage 1 cluster output plus per-post metadata pulled from the `mentions` table.

### Per-cluster signals

| Signal | Definition | Range |
|---|---|---|
| `frequency` | Count of distinct `evidence.post_ids` for the cluster | integer |
| `intensity` | LLM-judged sentiment strength across the cluster's quotes | 1–5 (1 = mild gripe, 5 = "I'm switching tomorrow") |
| `recency` | Days since median `createdAt` across evidence posts | float days |
| `specificity` | LLM-judged: 1 = vague ("bad UX") 5 = concrete ("export to CSV truncates over 10k rows") | 1–5 |

`frequency` and `recency` are computed deterministically from DB rows. `intensity` and `specificity` are LLM-judged in stage 2 (small prompt: cluster description + quotes only).

### Composite painScore (0–100)

```
normFreq        = min(frequency / 10, 1)               // saturates at 10 posts
normIntensity   = (intensity - 1) / 4                  // 0..1
normRecency     = clamp(1 - (recency / 365), 0, 1)     // newer = higher, 0 if older than 1y
normSpecificity = (specificity - 1) / 4                // 0..1

painScore = round(100 * (
  0.35 * normFreq +
  0.30 * normIntensity +
  0.20 * normSpecificity +
  0.15 * normRecency
))
```

Weights chosen so frequency and intensity dominate but a single rage-post can't outrank a sustained complaint, and stale-but-loud complaints are penalized.

### Usage

- Clusters in stage 3 input are sorted by `painScore` desc.
- Top N (N=8) passed to stage 3; the rest are dropped but kept in DB as `extraClusters` for the expandable UI.
- Frontend displays `painScore` as the cluster rank order. No raw numeric display in MVP unless useful for transparency.

---

## 3. Opportunity scoring

Product opportunities are derived in stage 3, not stage 1, because an opportunity is a synthesis (pain × competitor weakness × differentiation). Each opportunity must reference cluster ids it draws from.

### Per-opportunity signals

| Signal | Definition | Source |
|---|---|---|
| `marketPain` | Max `painScore` across linked cluster ids | computed from stage 2 |
| `differentiation` | LLM-judged: how badly does the competitor lose on this axis? 1–5 | stage 3 |
| `evidenceCount` | Sum of distinct evidence post_ids across linked clusters | computed |
| `clusterIds` | Which clusters back this opportunity | stage 3 |

### Composite opportunityScore (0–100)

```
normPain  = marketPain / 100
normDiff  = (differentiation - 1) / 4
normEvi   = min(evidenceCount / 15, 1)

opportunityScore = round(100 * (
  0.45 * normPain +
  0.35 * normDiff +
  0.20 * normEvi
))
```

### Usage

- Top 3 opportunities (highest `opportunityScore`) are pinned at the top of the report as "Top 3 Opportunities" — this is the section a founder actually screenshots.
- All opportunities returned, but only top 3 surfaced above the fold in the UI.
- Each opportunity must cite ≥1 `clusterId` and ≥3 `evidence.post_ids` across those clusters or it is dropped by the validator (see §9).

---

## 4. Voice of customer extraction

Stage 1 emits a second output alongside clusters: verbatim phrase mining. This is separate from cluster evidence quotes because the goal is reusable copy, not narrative support.

### Schema

```ts
type VoiceOfCustomerPhrase = {
  phrase: string;          // exact substring from a post, ≤140 chars, no paraphrasing
  frequency: number;       // how many distinct posts contain this phrase or a near-duplicate
  examplePostIds: string[]; // up to 5 post ids
  category: "complaint" | "wish" | "comparison" | "switching" | "praise";
};
```

### Extraction rules (system prompt)

- Quote verbatim. Never paraphrase. Strip punctuation only.
- Reject phrases under 4 words and over 25 words.
- Reject phrases that name the product itself in the phrase ("X is bad" → drop "X is").
- Prefer repeated adjective phrases ("clunky", "feels dated", "slow as hell") and repeated complaint structures ("can't even <verb>", "wish it would <verb>").
- Minimum `frequency` to include: 2 (must appear in ≥2 distinct posts).
- Return at most 20 phrases, ordered by frequency desc.

### Usage

- Powers the "Voice of Customer" report section directly.
- Phase 5 will reuse this to generate landing-page copy. The schema is forward-compatible — `category` is already segmented for that use.

---

## 5. Goal-conditioned output

The `reports` table already accepts `founder_goal`. Allowed values for this spec:

- `validate_idea` — "should I even build this?"
- `improve_positioning` — "how do I message against the incumbent?"
- `decide_mvp` — "what feature set ships first?"
- `find_wedge` — "what is the underserved niche?"
- `general` — no specific goal

Stage 3 receives `founder_goal` in its system prompt. The base report shape (all 10 PRD §10 sections) is always emitted, but section depth, ordering, and tone shift.

### Per-goal emphasis

| Goal | Emphasized sections | De-emphasized | Prompt variation |
|---|---|---|---|
| `validate_idea` | `painClusters`, `topOpportunities`, `executiveSummary` | `positioningAngles` (1 line instead of full angles), `voiceOfCustomer` | "Lead with whether the pain is real, frequent, and recent. Answer the question 'is this worth building?' in the first sentence of the summary." |
| `improve_positioning` | `positioningAngles` (5 angles, each with full messaging copy: tagline + headline + subhead), `competitorWeaknesses`, `voiceOfCustomer` | `featureGaps` (1-line list only) | "Write messaging a founder could paste into a landing page hero today. Each angle needs a verbatim quote from the evidence." |
| `decide_mvp` | `featureGaps` (priority-ranked: must-have / should-have / nice-to-have based on frequency × intensity), `productOpportunities`, `painClusters` | `positioningAngles` (collapsed to 2), `pricingPain` (1 line) | "Rank feature gaps by how many distinct users requested them. Recommend the smallest shippable subset." |
| `find_wedge` | `productOpportunities`, `switchingSignals`, `competitorWeaknesses` | `pricingPain`, `voiceOfCustomer` (3 phrases only) | "Identify the underserved sub-segment. Name the specific user type and the specific moment they churn." |
| `general` | All equal | — | Default opinionated tone, no section weighting. |

### Implementation note

The schema is the same regardless of goal — sections never disappear, they shrink. The frontend renders the same component tree. Per-goal depth is enforced by stage 3 prompt instructions, validated by post-stage checks (e.g., positioning goal: `positioningAngles.length >= 5`, each has `tagline` and `headline` populated).

---

## 6. Source evidence

Every claim in the report cites Reddit post ids. No exceptions.

### Evidence shape

```ts
type Evidence = {
  postIds: string[];     // synthetic ids p001..p150, mapped back to mentions.externalId
  topQuotes: string[];   // up to 3 verbatim quotes, ≤200 chars each
};
```

### Where evidence attaches

- `painClusters[].evidence` — required, ≥2 post_ids
- `featureGaps[].evidence` — required, ≥1 post_id
- `pricingPain.evidence` — required if section is non-empty
- `switchingSignals[].evidence` — required, ≥1 post_id
- `competitorWeaknesses[].evidence` — required, ≥1 post_id
- `productOpportunities[].evidence` — required, ≥3 post_ids across linked clusters
- `positioningAngles[].evidence` — required, ≥1 verbatim quote pulled from a real post
- `voiceOfCustomerPhrases[].examplePostIds` — required, ≥1
- `nextActions[].evidence` — required, ≥1 cluster id

### Post id mapping

Stage 1 sees posts pre-labelled with synthetic IDs (`p001`, `p002`, …) to keep the prompt clean. A mapping `syntheticId → mentions.externalId` lives in memory for the lifetime of the job. When persisting `reports.output`, all synthetic ids are rewritten to `mentions.externalId` so the frontend can link to Reddit. (The `mentions` table already stores `externalId` and `url`.)

### Frontend contract

Frontend renders evidence as expandable accordions per the existing `PainClusterCard` pattern. Each `postId` links to `mentions.url`. Quote pills shown inline.

---

## 7. Prompt design principles

These apply to every system prompt across stages 1–4.

### Anti-generic

- "Never say 'users want better UX'. Name the specific feature, the specific friction, and the specific quote."
- "Never use the words: 'streamlined', 'robust', 'comprehensive', 'leverage', 'seamless', 'intuitive', 'user-friendly', 'pain points' (in the report body — meta only)."
- "If a sentence would survive a find-and-replace of the competitor name with any other product, rewrite it."

### Forced specificity

- "If you cannot cite a post_id, do not include the claim. There is no penalty for fewer claims; there is a penalty for unsupported claims."
- "Every cluster description must contain at least one concrete noun the user named (feature, workflow, integration, price tier)."

### Opinionated tone

- "You are advising a founder, not surveying a market. Use 'You should…', 'Don't…', 'The wedge is…'. Avoid 'It appears that', 'Some users feel'."
- "Take a side on every opportunity. If you would not build it, say so."

### Founder language

- "Write for someone deciding what to build tomorrow morning, not a McKinsey deck. Short sentences. Active voice. Concrete verbs."
- "Length budget: executive summary ≤ 4 sentences. Each cluster description ≤ 2 sentences. Each positioning angle: 1 tagline + 1 headline + 1 subhead, nothing else."

### Stage-specific guard rails

- Stage 1: "Group by user pain, not feature. A cluster needs ≥2 independent posts. If only one post mentions a theme, drop it."
- Stage 2: "You do not see post bodies. Score using the cluster description, quotes, and metadata only."
- Stage 3: "You see scored clusters, not raw posts. Do not invent new pains. If a section has no supporting cluster, return an empty array — do not fabricate."
- Stage 4: "Each next action ties to a specific cluster id. Vague advice ('improve marketing') is forbidden."

---

## 8. Output JSON schema (TS-like)

This is the shape stored in `reports.output` (jsonb). The shared Zod schema in `@rivaleye/shared` mirrors this.

```ts
type PainReportOutput = {
  meta: {
    competitor: string;
    category: string;
    founderGoal: FounderGoal;
    generatedAt: string;          // ISO
    postCount: number;            // mentions count fed into stage 1
    modelTier: "free" | "paid";
    pipelineVersion: "2026-05-16-multi-pass-v1";
  };

  executiveSummary: string;       // ≤ 4 sentences, opinionated

  topOpportunities: Opportunity[]; // length === 3, pinned, sorted by opportunityScore desc

  painClusters: PainCluster[];     // sorted by painScore desc, length 4–10

  featureGaps: FeatureGap[];       // length 0–15, ranked when goal=decide_mvp

  pricingPain: {
    summary: string;               // "" if no signal
    evidence: Evidence;
  };

  switchingSignals: SwitchingSignal[];

  voiceOfCustomer: VoiceOfCustomerPhrase[]; // length 0–20

  competitorWeaknesses: CompetitorWeakness[];

  productOpportunities: Opportunity[]; // full list, includes top 3

  positioningAngles: PositioningAngle[]; // length depends on goal

  nextActions: NextAction[];       // 3–7 items, opinionated, goal-conditioned

  extraClusters: PainCluster[];    // overflow from stage 2, not surfaced above the fold
};

type PainCluster = {
  id: string;                      // c01, c02, ...
  title: string;                   // 3–7 words
  description: string;             // ≤ 2 sentences, concrete nouns required
  painScore: number;               // 0–100
  scores: {
    frequency: number;
    intensity: 1 | 2 | 3 | 4 | 5;
    recencyDays: number;
    specificity: 1 | 2 | 3 | 4 | 5;
  };
  evidence: Evidence;
};

type FeatureGap = {
  feature: string;
  description: string;
  priority: "must" | "should" | "nice"; // only set when goal=decide_mvp
  requestCount: number;
  evidence: Evidence;
};

type SwitchingSignal = {
  from: string;                    // usually the competitor
  to: string | null;               // named alternative if mentioned
  trigger: string;                 // what caused them to consider leaving
  evidence: Evidence;
};

type VoiceOfCustomerPhrase = {
  phrase: string;
  frequency: number;
  examplePostIds: string[];
  category: "complaint" | "wish" | "comparison" | "switching" | "praise";
};

type CompetitorWeakness = {
  weakness: string;
  whyItMatters: string;
  evidence: Evidence;
};

type Opportunity = {
  id: string;                      // o01, ...
  title: string;
  thesis: string;                  // 1–2 sentences, opinionated
  opportunityScore: number;        // 0–100
  scores: {
    marketPain: number;            // pulled from painScore
    differentiation: 1 | 2 | 3 | 4 | 5;
    evidenceCount: number;
  };
  clusterIds: string[];
  evidence: Evidence;
};

type PositioningAngle = {
  angle: string;                   // short label
  tagline: string;                 // ≤ 60 chars
  headline: string;                // ≤ 100 chars
  subhead: string;                 // ≤ 160 chars
  evidence: Evidence;              // includes verbatim quote
};

type NextAction = {
  action: string;                  // imperative, ≤ 90 chars
  rationale: string;               // 1 sentence tying to evidence
  clusterIds: string[];
  evidence: Evidence;
};

type Evidence = {
  postIds: string[];               // mentions.externalId
  topQuotes: string[];             // verbatim, ≤ 200 chars each
};

type FounderGoal =
  | "validate_idea"
  | "improve_positioning"
  | "decide_mvp"
  | "find_wedge"
  | "general";
```

Backwards compatibility: the existing `PainReportOutput` shape in `@rivaleye/shared` is replaced. Pipeline version is stamped in `meta.pipelineVersion` so old reports can still be rendered by a legacy branch in the frontend if needed (not in scope for this MVP — pre-existing reports are flagged stale).

---

## 9. Quality gates

### Pre-flight gate (before stage 1)

- `mentions.count(reportId) >= 20` → proceed.
- `< 20` → mark report `status="failed"`, write `output.meta.error = "not_enough_signal"` and a human-readable hint: "Only N Reddit posts mentioned this competitor in the last 12 months. Try a broader competitor name, or check if the product is on Reddit at all."
- This is a fail-fast — no LLM calls made.

### Per-stage validation

Each stage's output is JSON-parsed and Zod-validated against its stage schema. On failure:

1. **First failure** → retry the same stage once with an augmented prompt: prepend "Your previous response failed validation: <validator error>. Return ONLY valid JSON matching the schema. Cite post_ids on every claim."
2. **Second failure** → mark report `failed` with `output.meta.error = "stage_<n>_validation_failed"` and store the raw response in `output.meta.lastRaw` for debugging.

### Evidence-level validation (after stage 3)

Run before persisting `reports.output`:

| Check | Rule | On failure |
|---|---|---|
| Cluster evidence | every `painCluster.evidence.postIds.length >= 2` | drop the cluster, log |
| Opportunity evidence | every `productOpportunities[].evidence.postIds.length >= 3` | drop the opportunity, log |
| Top 3 opportunities | `topOpportunities.length === 3` after drops | if fewer remain, fill from `productOpportunities` sorted by score; if still <3, report still ships but `meta.warnings += "few_opportunities"` |
| Post id integrity | every cited `postId` exists in the `mentions` table for this `reportId` | drop the offending claim, log; if >20% of claims are dropped, treat as stage-3 validation failure and retry |
| Per-goal section depth | e.g. goal=improve_positioning ⇒ `positioningAngles.length >= 5` and each has non-empty tagline/headline/subhead | retry stage 3 once with stricter prompt; on second failure, ship with `meta.warnings` |
| Generic-phrase blocklist | none of the banned phrases (see §7) appear in `executiveSummary` or cluster descriptions | retry stage 3 once with the offending phrases echoed back |

### Hard failure mode

If after one retry the report still fails validation, mark `status="failed"`, persist `output.meta.error` + `output.meta.lastRaw`, surface a useful frontend message ("We pulled N posts but couldn't synthesize a sharp report. Retry, or try a more specific competitor."). Never ship an empty `DEFAULT_OUTPUT` silently like the current implementation does.

---

## 10. Out of scope

- **Cross-competitor comparison** — Phase 3. This spec covers a single competitor per report.
- **Second-source fusion** (G2, Twitter, etc.) — Phase 4. Reddit only.
- **Landing page copy generation** — Phase 5. The Voice of Customer schema is forward-compatible but no generator is specced here.
- **Report regeneration UI** — Phase 2. MVP creates one report per `(competitor, category, founder_goal)`.
- **Caching of stage 1 across goals** — listed as a future optimization. Not in MVP.
- **Embedding-based deduplication of clusters** — possible quality lift, deferred.
- **Per-section streaming to frontend** — reports are written atomically when complete.

---

## Self-review notes

- Stage 1 sees full posts; stages 2–4 see compressed JSON only — confirmed consistent across §1, §6, §7.
- Post id flow: synthetic `p001..p150` in prompts → rewritten to `mentions.externalId` before persist — covered in §6.
- `founder_goal` enum is defined once in §5 and reused in §8. No drift.
- Composite scores (painScore, opportunityScore) are defined once in §2/§3 and referenced by §3/§5/§9 without redefinition.
- Quality gates in §9 reference stages from §1 and schema from §8 — all referenced fields exist in the schema.
- `extraClusters` introduced in §2 ("kept in DB") and present in schema in §8.
- Goal-conditioned depth rules in §5 are enforced by validation in §9 — closed loop.
- Model bump recommendation is consistent: keep free for MVP, stage 3 only on paid bump, never bump stage 1.
- "Out of scope" matches the brief's exclusions exactly.
