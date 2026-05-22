# 15 — Signal-Centric Pipeline Redesign

**Status:** Design proposal — not yet approved, not implemented.
**Date:** 2026-05-22
**Author:** Pipeline redesign working session.
**Related:** `docs/product-goal.md` (canonical product vision), `16-dashboard-data-contracts.md` (companion — exact dashboard data contracts), `00-rivaleye-pipeline-architecture-review.md`, `13-postgres-runner-implementation-report.md`.

---

## Why this document exists

RivalEye's product direction has moved. It is **the user-perception layer of competitor research** — see `docs/product-goal.md`. It must surface what users **love**, **dislike**, **want next**, and **why they may switch**, then turn that into product, positioning, and growth decisions for four roles (founder, product, marketing, growth).

The current LLM pipeline does not match this. It is **complaint-centric**: it was built to produce a "Competitor Pain Report". Love is not a first-class signal, and the output is not organized by role.

This document analyzes the current pipeline precisely, defines a new **signal-centric** model, redesigns all five stages, recommends a database strategy, and gives a phased, backward-compatible migration plan. **No code is written here.**

---

## 1. Current pipeline analysis

### 1.1 Files inspected

| File | Role |
|---|---|
| `packages/worker/src/pipeline/run.ts` | Stage C→D→E orchestrator, checkpointing, persist call |
| `packages/worker/src/prompts/shared.ts` | All four Zod schemas + `PipelineCtx` |
| `packages/worker/src/prompts/platform/reddit/extract.ts` | Stage A prompt (representative platform) |
| `packages/worker/src/prompts/cross/merge.ts` | Stage C prompt |
| `packages/worker/src/prompts/cross/synth.ts` | Stage D prompt |
| `packages/worker/src/prompts/cross/refine.ts` | Stage E prompt |
| `packages/worker/src/pipeline/stage-d-synth.ts` | Stage D runner + `enrichSynthOutput()` |
| `packages/worker/src/pipeline/stage-e-refine.ts` | Stage E runner + draft fallback |
| `packages/worker/src/pipeline/persist.ts` | Writes `SynthOutput` into report sub-tables |
| `packages/api/src/db/schema/reports.ts` | `reports` + all `report_*` output tables |
| `packages/api/src/db/schema/pipeline.ts` | `report_platform_briefs`, `report_pipeline_checkpoints`, job tables |
| `packages/api/src/controllers/reports/handlers/` | 16 granular GET endpoints the web app reads |
| `packages/shared/src/llm/config.ts` | `ENABLED_PLATFORMS` |

Stage A/B/C runners (`stage-a-extract.ts`, `stage-b-summarize.ts`, `stage-c-merge.ts`) and the six other platform prompt folders were inspected via their schemas, `run.ts`, and the Reddit prompt as the representative pattern — all platform prompts share the `platformExtractSchema` / `platformBriefSchema` contract.

### 1.2 Current Stage A schema — `platformExtractSchema`

Per-platform extraction. Runs once per platform, on that platform's raw posts.

```
complaints:          [{ text, severity 0..1, evidence_ids[] }]
features_requested:  [{ feature, evidence_ids[] }]
pricing_signals:     [{ note, evidence_ids[] }]
switching_signals:   [{ direction: inbound|outbound, competitor, evidence_ids[] }]
voice_phrases:       { positive: string[], negative: string[] }
notable_quotes:      [{ author, text, evidence_id }]
```

### 1.3 Current Stage B schema — `platformBriefSchema`

Per-platform summary built from the platform's extract.

```
platform, headline, top_themes[{theme, weight}],
sentiment { positive, neutral, negative },
most_quoted_competitors[], evidence_coverage
```

### 1.4 Current Stage C schema — `mergedClustersSchema`

Cross-platform merge of all platform extracts + briefs.

```
complaint_clusters:   [{ title, summary, severity, platforms[], evidence_ids[], sample_quote }]
feature_clusters:     [{ feature, demand_score, platforms[], evidence_ids[] }]
pricing_clusters:     [{ tier_label, pain, note, platforms[], sample_quotes[] }]
switching_clusters:   [{ direction, competitor, count, share, platforms[] }]
voice_top:            { positive[{word,count}], negative[{word,count}] }
cross_platform_themes:[{ theme, platforms[], weight }]
```

### 1.5 Current Stage D schema — `synthOutputSchema`

The big synthesis object. 14 top-level keys.

```
complaints, feature_gaps, pricing_tiers, pricing_quotes, switching, quotes,
voice_words, positioning, actions, leads, opportunities, threads,
report_meta, executive_brief
```

`enrichSynthOutput()` (in `stage-d-synth.ts`) deterministically overrides three things after the LLM call: `complaints[].mentions` (from `evidence_ids.length`), `quotes` (from extracts' `notable_quotes`), and `report_meta` sentiment (averaged from briefs).

### 1.6 Current Stage E behavior

`runStageERefine()` runs a single critique-and-revise LLM pass over the Stage D draft against the merged clusters. Same `synthOutputSchema` in and out. Rules: strengthen thin sections, drop ungrounded items, keep `external_id`s stable, rewrite `executive_brief`. **If the call fails or schema-mismatches, it silently falls back to the unrefined Stage D draft** (`fellBackToDraft: true`).

### 1.7 Where complaints are first-class (the problem)

- **Stage A:** `complaints` carry a `severity` score. No other signal category gets a strength score.
- **Stage C:** the merge prompt rule #1 explicitly targets **"8–15 complaint_clusters"**. No target for any other cluster type.
- **Stage D:** `complaints` is the richest object (9 fields: `external_id`, `title`, `tag`, `mentions`, `delta`, `severity`, `summary`, `threads`, `sample`). `opportunities.anchor_complaint_external_id` ties opportunities **to complaints**. `threads.complaint_external_id` ties evidence threads **to complaints**.
- **DB:** `report_complaints` is the richest table. `report_opportunities.anchor_complaint_external_id` and `report_threads.complaint_external_id` **hard-code "complaint" as the anchoring concept** in the schema.
- **Prompts:** `synth.ts` and `refine.ts` system prompts literally call the output a *"competitor pain report"*.

### 1.8 Where love signals are missing

- **Stage A:** there is **no `love` array**. Positive perception exists only as `voice_phrases.positive` (bare 1–3 word strings) and — incidentally — `sentiment.positive` at Stage B. Worse: `notable_quotes` is instructed (Reddit prompt, line 23) to capture quotes that *"illustrate a core pain"* — quote capture is pain-biased by design.
- **Stage C:** **no `love_clusters`**. Positive signal survives only as `voice_top.positive` (word + count).
- **Stage D:** **no love section**. Positive perception is reduced to `report_meta.sentiment_positive` (a float) and `voice_words` rows with `kind=positive`. There is no structured "what users love" object with a summary, evidence, or strength.
- **DB:** **no `report_love` table.** Nothing persists structured love signal.
- **Net effect:** RivalEye structurally cannot answer "what do users love about this competitor?" or "why do users stay?" — two explicit product questions from `docs/product-goal.md`.

### 1.9 Where ICP / role-dashboard support is missing

- The only role hint anywhere is `report_actions.role` — a free-text column with suggested values `Founder|PM|Marketing|Engineering|Sales`. It is per-action, not a structured view.
- There is **no `founder_view` / `product_view` / `marketing_view` / `growth_view`** concept in any schema, prompt, table, or endpoint.
- `report_goal_enum` (`validate_idea`, `find_weaknesses`, `improve_positioning`, `decide_mvp_features`, `find_user_pain`, `compare_alternatives`) captures *intent* at report creation but the pipeline never branches output by role or goal.
- The web app's report tabs are **signal-type tabs** (complaints, pricing, switching, voice…), not **role tabs**. A founder and a marketer see the same undifferentiated report.

**Conclusion:** the pipeline is a single-audience pain-report generator. The product needs a four-signal, four-role perception engine.

---

## 2. New signal model

### 2.1 The common `Signal` shape

Every signal — regardless of type — shares one base shape so Stage C clustering, Stage D role-mapping, and the evidence index can treat them uniformly.

| Field | Type | Purpose |
|---|---|---|
| `id` | string (kebab slug) | Stable identifier, unique within a report. Used for anchoring/linking. |
| `type` | enum | `love` \| `pain` \| `gap` \| `switch` \| `pricing` \| `feature` \| `positioning` |
| `title` | string | 3–6 word label. |
| `summary` | string | 1–2 sentences: what the signal is, who it affects, concretely. |
| `sentiment` | number −1..1 | Emotional valence of the signal. Love trends positive, pain negative, gap/switch neutral-to-negative. |
| `strength_or_severity` | number 0..1 | How intense the signal is. For love = strength of praise; for pain = severity; for gap = demand; for switch = intent strength. |
| `frequency` | integer | Count of distinct source posts/comments expressing it (= `source_ids.length`). |
| `confidence` | number 0..1 | How well-grounded the signal is (evidence volume × source spread × quote directness). |
| `source` | string[] | Platforms it appeared on, e.g. `["reddit","g2"]`. |
| `source_ids` | string[] | Evidence IDs (mention IDs) backing it. The audit trail. |
| `representative_quotes` | `{ author, text, source_id }[]` | 1–3 verbatim user quotes. |
| `related_features` | string[] | Named competitor features this signal touches (links signals to the feature map). |
| `user_segment` | string \| null | Inferred segment if stated (e.g. "solo devs", "enterprise admins"). |
| `role_relevance` | enum[] | Subset of `founder` \| `product` \| `marketing` \| `growth`. Drives Stage D role-mapping. |
| `source_date` | ISO string \| null | Earliest/representative source date if available; else null. |

`created_at` is the persistence timestamp (DB default), distinct from `source_date` (when users actually said it).

### 2.2 The seven first-class signal types

All seven signal types — `love`, `pain`, `gap`, `switch`, `pricing`, `feature`, `positioning` — are **first-class and extracted at Stage A**. `love`/`pain`/`gap`/`switch` are the product's headline model; `pricing`/`feature`/`positioning` deepen the role views. `evidence_quotes` is not a signal type — it is the cross-cutting quote index that every signal and every dashboard insight references for grounding.

---

#### 2.2.1 `love_signals` — **NEW**

- **Purpose:** what users praise, value, and stay for. Prevents teams from attacking a competitor's genuine strength.
- **Fields:** base `Signal`, `type="love"`. `strength_or_severity` = strength of praise. `related_features` heavily used.
- **Example:** `{ id:"love-fast-onboarding", title:"Fast onboarding", summary:"Users repeatedly praise getting to first value within 10 minutes; contrasted favorably against heavier competitors.", sentiment:0.8, strength_or_severity:0.7, frequency:14, source:["reddit","g2"], representative_quotes:[{author:"u/devmatt", text:"had it running before my coffee got cold"}], related_features:["setup wizard"], role_relevance:["founder","product","marketing"] }`
- **ICPs:** founder (what to respect, not attack), product (what to match/learn), marketing (promise-vs-reality framing).
- **Dashboards:** Overview (top love signal), Founder (strengths to respect), Product (loved competitor features), Marketing (promise vs reality).

#### 2.2.2 `pain_signals` — generalized from current `complaints`

- **Purpose:** repeated complaints — friction, bugs, support failures, UX problems, unmet expectations.
- **Fields:** base `Signal`, `type="pain"`. `strength_or_severity` = severity. Carries optional `tag` (`UX|Pricing|Support|Reliability|Onboarding|API|Billing`).
- **Example:** `{ id:"pain-opaque-pricing", title:"Opaque pricing", summary:"Solo devs report surprise carrier surcharges they could not predict; described as feeling deceived.", sentiment:-0.7, strength_or_severity:0.85, frequency:22, ... }`
- **ICPs:** founder (weaknesses to attack), product (complaint clusters by area), marketing (objections), growth (pain leads).
- **Dashboards:** Overview, Founder, Product, Marketing, Growth.

#### 2.2.3 `gap_signals` — generalized from current `feature_gaps`

- **Purpose:** capabilities users explicitly ask for but the competitor does not provide. Distinct from pain (pain = something is bad; gap = something is missing).
- **Fields:** base `Signal`, `type="gap"`. `strength_or_severity` = demand intensity.
- **Example:** `{ id:"gap-recurring-tasks", title:"Recurring tasks", summary:"Users repeatedly request native recurring/scheduled tasks and resort to manual duplication.", sentiment:-0.3, strength_or_severity:0.6, frequency:11, ... }`
- **ICPs:** founder (unmet needs, wedge), product (roadmap opportunities, MVP scoping).
- **Dashboards:** Overview, Founder, Product.

#### 2.2.4 `switch_signals` — generalized from current `switching_signals`

- **Purpose:** users showing intent to leave the competitor, evaluate alternatives, or having already switched. Buying-intent feed.
- **Fields:** base `Signal`, `type="switch"`, plus `direction` (`inbound` = coming to competitor / `outbound` = leaving it) and `alternatives_mentioned: string[]`.
- **Example:** `{ id:"switch-evaluating-plivo", title:"Evaluating Plivo", summary:"Several users actively pricing out Plivo and Voco after billing frustration.", sentiment:-0.4, strength_or_severity:0.7, frequency:9, direction:"outbound", alternatives_mentioned:["Plivo","Voco"], ... }`
- **ICPs:** growth (switch-intent feed, leads), marketing (comparison content), founder (market opening).
- **Dashboards:** Overview, Growth (primary), Marketing, Founder.

#### 2.2.5 `pricing_signals` — generalized from current `pricing_signals` / `pricing_clusters`

- **Purpose:** how users perceive the competitor's pricing — value-for-money, tier friction, surprise costs, specific prices quoted.
- **Fields:** base `Signal`, `type="pricing"`, plus `tier_label: string|null`, `quoted_price: string|null`.
- **ICPs:** founder (pricing opportunity), marketing (objections), growth (pricing-pain leads).
- **Dashboards:** Founder, Marketing, Growth.

#### 2.2.6 `feature_signals` — **generalized; replaces narrow "feature_clusters"**

- **Purpose:** the **map of named competitor features** users discuss — whether loved, criticized, or compared. This is the product-area index. It is the join key: love/pain/gap signals reference features via `related_features`.
- **Fields:** base `Signal`, `type="feature"`, plus `feature_name`, `perception` (`loved|mixed|criticized`), `linked_signal_ids: string[]`.
- **ICPs:** product (feature gap map, complaint-by-area), founder (strength/weakness map).
- **Dashboards:** Product (primary), Founder.

#### 2.2.7 `positioning_signals` — generalized from current `positioning`

- **Purpose:** how users *talk about* the competitor and category — the language they use, category perception, competitor promise vs. user reality, objections, and comparison framing. Extracted at Stage A like every other signal (not deferred to synthesis).
- **Fields:** base `Signal`, `type="positioning"`, plus `angle` (the framing/claim), `against` (the competitor promise or weakness it exposes), `audience`.
- **ICPs:** founder (positioning move), marketing (positioning angles, objections, copy).
- **Dashboards:** Founder, Marketing.

#### 2.2.8 `evidence_quotes` — the quote index (not a signal type)

- **Purpose:** the single deduplicated pool of verbatim user quotes. Every signal's `representative_quotes` points into it by `source_id`. Powers the Evidence dashboard and "every claim is grounded" verification.
- **Fields:** `{ id, text, author, platform, url, source_id, signal_ids[], signal_type, sentiment, score, source_date }`.
- **ICPs:** all — it is the trust layer.
- **Dashboards:** Evidence (primary), and every other dashboard cites into it.

### 2.3 Signal-type → dashboard matrix

| Signal | Overview | Founder | Product | Marketing | Growth | Evidence |
|---|---|---|---|---|---|---|
| love | ● | ● | ● | ● | | ◦ |
| pain | ● | ● | ● | ● | ● | ◦ |
| gap | ● | ● | ● | | | ◦ |
| switch | ● | ● | | ● | ● | ◦ |
| pricing | | ● | | ● | ● | ◦ |
| feature | | ● | ● | | | ◦ |
| positioning | ● | ● | | ● | | ◦ |
| evidence_quotes | | ◦ | ◦ | ● | ● | ● |

● = primary consumer ◦ = cited into

---

## 3. New Stage A design

Stage A becomes **signal extraction**. Per platform, per raw post batch, it outputs signal groups instead of a complaint-first shape.

### 3.1 New `StageAExtract` shape

```
love_signals:        Signal[]   (type=love)
pain_signals:        Signal[]   (type=pain)
gap_signals:         Signal[]   (type=gap)
switch_signals:      Signal[]   (type=switch, + direction, alternatives_mentioned)
pricing_signals:     Signal[]   (type=pricing, + tier_label, quoted_price)
feature_signals:     Signal[]   (type=feature, + feature_name, perception)
positioning_signals: Signal[]   (type=positioning)   -- how users talk about the competitor/category
voice_phrases:       { positive: string[], negative: string[] }
evidence_quotes:     EvidenceQuote[]   (balanced: love AND pain quotes, not pain-biased)
```

At Stage A, signals are **raw and platform-local**: `frequency` = local count, `source` = single platform, `confidence` lower (one platform). Stage C aggregates them.

### 3.2 Prompt changes

- Each platform's `extract.ts` system prompt is rewritten to extract **all seven signal groups**, with explicit instruction to give **love equal attention to pain**.
- The `notable_quotes` → `evidence_quotes` rename includes removing the pain-bias instruction ("illustrate a core pain") — quotes must be captured for love, pain, gap, and switch in proportion to what the posts contain.
- Reddit, App Store, Play Store, HackerNews, ProductHunt, Dev.to, Website — all seven `extract.ts` files updated. Shared rules live in one place (see §10) to avoid seven-way drift.

### 3.3 Backward compatibility strategy (critical)

Stage B and Stage C currently consume `platformExtractSchema`. We do **not** break them on day one.

**Strategy: code-level legacy adapter, not prompt duplication.**

1. Stage A's LLM emits only the **new** `stageAExtractSchema`. We do not ask the LLM to fill old fields too (wasteful, drift-prone).
2. A pure function `toLegacyExtract(newExtract): PlatformExtract` derives the old shape from the new one:
   - `complaints` ← `pain_signals` (map `title`/`summary`→`text`, `strength_or_severity`→`severity`)
   - `features_requested` ← `gap_signals`
   - `pricing_signals` ← `pricing_signals`
   - `switching_signals` ← `switch_signals`
   - `voice_phrases` ← carried through unchanged
   - `notable_quotes` ← `evidence_quotes`
3. `report_platform_briefs.extract` stores **both**: the new extract under a new JSON key and the legacy-derived extract under the existing key — until Stage C is migrated (Phase 2). Love data is preserved in the new key even while old stages ignore it.

This means **Phase 1 ships with zero changes to Stage B/C/D/E** — they keep reading the legacy shape — while love data starts being captured and stored immediately.

---

## 4. New Stage B design

Stage B stays **per-platform** but its `PlatformBrief` is widened from a sentiment-and-themes summary into a **balanced perception summary**.

### 4.1 New `PlatformBrief` shape

```
platform
headline                       -- one line: the platform's overall verdict on the competitor
what_users_love:      string[] -- top positive themes on this platform
what_users_complain:  string[] -- top pain themes
what_users_want:      string[] -- top gap themes
switch_intent:        { outbound_count, inbound_count, alternatives[] }
pricing_perception:   string|null
competitor_strengths: string[]
competitor_weaknesses:string[]
user_language:        { positive: string[], negative: string[] }
sentiment:            { positive, neutral, negative }
source_quality:       { post_count, evidence_coverage 0..1, confidence 0..1 }
```

`confidence` and `source_quality` are new and explicit — a brief built from 4 posts must not read as authoritative as one built from 120. This feeds Stage C confidence weighting and the Evidence dashboard.

### 4.2 Backward compatibility

The old `platformBriefSchema` (headline, top_themes, sentiment, most_quoted_competitors, evidence_coverage) is **derivable** from the new shape. Same adapter pattern as §3.3: `toLegacyBrief()` lets Stage C keep working until Phase 2.

---

## 5. New Stage C design

Stage C becomes **multi-signal cross-platform clustering**. It collapses platform-local signals into report-level clusters — for **every** signal type, not just complaints.

### 5.1 New `MergedSignals` shape

```
love_clusters:        SignalCluster[]
pain_clusters:        SignalCluster[]
gap_clusters:         SignalCluster[]
switch_clusters:      SignalCluster[]
pricing_clusters:     SignalCluster[]
feature_clusters:     SignalCluster[]
positioning_clusters: SignalCluster[]
evidence_index:       EvidenceQuote[]   -- deduplicated, every quote, keyed by id
cross_platform_themes:[{ theme, signal_type, platforms[], weight }]
```

### 5.2 `SignalCluster` shape

```
id
type                  -- love|pain|gap|switch|pricing|feature|positioning
title
summary
frequency             -- total distinct source posts across platforms
source_spread:        { platforms: string[], platform_count: int }
confidence            -- 0..1: f(frequency, source_spread, quote directness)
strength_or_severity  -- mean across member signals
representative_quotes -- 2-3, pulled from evidence_index by id
related_signal_ids    -- cross-links (e.g. a pain cluster linked to a gap cluster)
related_features      -- named features touched
role_relevance        -- founder|product|marketing|growth subset
member_source_ids     -- ALL evidence ids (the true frequency; never truncated)
```

### 5.3 Prompt changes

- `merge.ts` rewritten: the **"8–15 complaint_clusters"** target is removed. Each signal type gets its own clustering guidance; **love clusters are required** when love signal exists.
- The "never truncate evidence_ids" rule is kept and applied to every cluster type (`member_source_ids`).
- `confidence` is computed deterministically in code after the LLM call (like `enrichSynthOutput` does today for `mentions`) — the LLM should not be trusted to compute it.

### 5.4 Backward compatibility

Stage C is the **fan-in point** — the riskiest stage. Phase 2 migrates it. Until then it runs on legacy adapters (§3.3). When migrated, a `toLegacyMerged()` adapter keeps Stage D running on the old `mergedClustersSchema` until Phase 3.

---

## 6. New Stage D design

Stage D stops producing one flat object and instead produces **six role-scoped sections**. Each section is assembled from the merged signal clusters by `role_relevance`.

> **The exact, field-level Zod data contract for every section and every widget is in the companion document `docs/architecture/16-dashboard-data-contracts.md`.** That document is normative — Stage D output must validate against its schemas. The summaries in §6.1–6.6 below are an overview only.

### 6.1 `overview`

- overall competitor perception (1 paragraph, balanced love + pain)
- top love signal, top pain signal, top gap signal, top switch signal (one each, with id refs)
- strongest opportunity (id ref)
- overall confidence score

### 6.2 `founder_view`

- opportunity score (0..100)
- market opening summary
- strengths to respect (from love clusters)
- weaknesses to attack (from pain clusters)
- unmet needs (from gap clusters)
- wedge recommendation
- pricing opportunity (from pricing clusters)
- strategic risks
- recommended product move / positioning move / growth move

### 6.3 `product_view`

- feature gap map (gap clusters × feature clusters)
- complaint clusters grouped by product area (pain clusters by `tag`/feature)
- loved competitor features (love clusters joined to feature clusters)
- workflow friction
- roadmap opportunities
- build / avoid / learn suggestions

### 6.4 `marketing_view`

- user language bank (positive phrases, negative phrases)
- positioning angles
- promise vs reality (competitor's claimed strengths vs love/pain reality)
- objections (from pain + pricing)
- comparison bullets
- copy ideas
- quote library (curated subset of evidence_index)

### 6.5 `growth_view`

- switch-intent feed (switch clusters, outbound-weighted)
- alternative-seeking posts
- pricing-pain leads
- communities to engage (platforms/subreddits with switch + pain density)
- priority score per lead
- suggested reply angles
- segment hints

### 6.6 `evidence`

- the full `evidence_index`: every quote with source link, signal type, related insight id, confidence, source date.

### 6.7 Grounding rule

Every claim in every role section must carry **signal id references** back to merged clusters, and through them to `source_ids`. A role section item with no traceable signal id is invalid and dropped in Stage E. `enrichSynthOutput`-style deterministic post-processing recomputes `frequency`, `confidence`, and `opportunity score` in code — never trusts the LLM for derived numbers.

---

## 7. New Stage E design

Stage E stays a **critique-and-revise** pass but its rules change for the role-section output.

- Polish each of the six role sections for clarity and specificity.
- **Remove duplicate insights** across role sections (the same pain may legitimately appear in founder + product + marketing — dedupe *within* a section, allow *cross*-section repetition only when the framing genuinely differs).
- **Every major claim must keep a signal id reference.** Drop any claim that lost its grounding.
- **Enforce balanced love/pain.** If `overview` or `founder_view` discusses only weaknesses, Stage E must pull in the love clusters. RivalEye must not read as "competitor sucks."
- Ensure each role section is **decision-useful**: founder gets moves, product gets build/avoid/learn, marketing gets copy, growth gets leads.
- **Validate the refined output against the doc 16 Zod role-section schemas.** If a section fails validation, fall back to that section's Stage D draft rather than emitting malformed JSON.
- Keep the existing **fallback-to-draft** safety behavior: if the refine call fails entirely, persist the Stage D output rather than failing the report — but log it loudly (today it only warns).

---

## 8. Database / output strategy

### 8.1 Current output tables (all in `packages/api/src/db/schema/reports.ts`)

`report_complaints`, `report_feature_gaps`, `report_pricing_tiers`, `report_pricing_quotes`, `report_switching`, `report_quotes`, `report_voice_words`, `report_positioning`, `report_actions`, `report_leads`, `report_opportunities`, `report_threads`, `report_thread_messages`, `report_platform_stats`, `report_subreddits` — plus `report_platform_briefs` and `report_pipeline_checkpoints` in `pipeline.ts`.

**Critical coupling:** the web app reads these through **16 granular endpoints** (`getComplaints`, `getFeatureGaps`, `getPositioning`, `getQuotes`, `getSwitching`, `getActions`, `getLeads`, `getOpportunities`, `getPricing`, `getVoice`, `getThreads`, `getThread`, `getSubreddits`, `getPlatforms`, `getSentimentSeries`, `getReport`). Each maps 1:1 to a table. Changing or dropping a table breaks the frontend immediately.

### 8.2 Option A — keep tables, add JSON `report_role_sections`

Keep every existing table and endpoint exactly as-is (legacy adapters keep them populated). Add **one** new table, one row per role section:

```
report_role_sections
  id             uuid pk
  report_id      uuid  FK → reports.id (cascade)
  section_type   enum: overview | founder | product | marketing | growth | evidence
  data           jsonb   -- validated against the doc 16 schema for this section_type
  schema_version integer
  created_at, updated_at
  UNIQUE (report_id, section_type)
```

One row per `(report_id, section_type)`. Each `data` blob validates against the matching Zod schema in doc 16; the merged signal clusters ride along in the `evidence` section row. New role dashboards read via one new endpoint; old dashboards keep working untouched.

- **Pros:** one additive migration, zero destructive change, frontend never breaks, each section independently writable (Stage E can re-emit one section), fast to ship, trivially reversible.
- **Cons:** `data` blobs are not column-level queryable in SQL; some duplication between legacy tables and JSON during the transition.

### 8.3 Option B — new normalized tables

Add `report_signal_clusters` (one row per cluster, typed) and `report_role_views` (one row per role). Migrate the frontend to read them. Eventually deprecate the 15 legacy tables.

- **Pros:** fully queryable, normalized, clean long-term model.
- **Cons:** many new tables + many new endpoints + a full frontend migration before anything ships; large surface area; slow; higher risk.

### 8.4 Recommendation — **Option A**

Adopt **Option A** (`report_role_sections`) for the MVP. It satisfies every hard constraint: additive only, no destructive migration, frontend stays compatible, and every role section + love signal gets a durable home on day one. One-row-per-section keeps each dashboard independently writable, and each `data` blob validates against doc 16. The not-column-queryable downside is irrelevant at MVP scale — reports are read whole. Option B is a worthwhile *later* normalization once the role-view shape has stabilized; out of scope here.

One new table. One new migration. One new read endpoint. Reversible.

---

## 9. Migration plan (phased)

Each phase is independently shippable and leaves the product working.

### Phase 1 — Capture love + generalized signals at Stage A
- Add `stageAExtractSchema` and the `Signal` shape to shared schemas.
- Rewrite the seven platform `extract.ts` prompts to emit the seven signal groups, love balanced with pain.
- Add `toLegacyExtract()` adapter; store **both** new and legacy extract JSON on `report_platform_briefs.extract`.
- **Stage B/C/D/E untouched** — they read the legacy shape.
- **Outcome:** love + all signals are captured and stored. Nothing downstream changes yet. Fully safe.

### Phase 2 — Multi-signal clustering at Stage C
- Add `mergedSignalsSchema` (`love_clusters` … `evidence_index`).
- Rewrite `merge.ts`; drop the complaint-count target; compute `confidence` in code.
- Add `toLegacyMerged()` adapter so Stage D keeps running on the old shape.
- Update Stage B to the wider `PlatformBrief` (with `toLegacyBrief()`).
- **Outcome:** clusters exist for every signal type. Stage D still emits the old report.

### Phase 3 — Role-based sections at Stage D + E
- Add `roleSectionsSchema` (overview, founder, product, marketing, growth, evidence).
- Rewrite `synth.ts` and `refine.ts` for role sections + grounding + balanced love/pain.
- Stage D still also emits the legacy `SynthOutput` (via adapters from clusters) so legacy tables stay populated.
- **Outcome:** role sections generated in-memory.

### Phase 4 — Persist role sections
- Add the `report_role_sections` table (one additive migration: `pnpm db:generate` + `pnpm db:migrate`).
- `persistReport()` upserts one row per `section_type` alongside the existing legacy-table writes.
- Add one read endpoint (`GET /v1/reports/:id/sections`) returning all six sections.
- **Outcome:** role sections + love clusters are durably stored and fetchable. Legacy report unaffected.

### Phase 5 — Frontend role dashboards
- Build Overview / Founder / Product / Marketing / Growth / Evidence dashboards reading the new endpoint.
- Old signal-type tabs can remain during transition, then be retired once role dashboards are validated.
- **Outcome:** the product delivers the four-role, four-signal experience.

---

## 10. Implementation plan

Detailed steps for execution. **Do not start until this design is approved.** This section feeds a `superpowers:writing-plans` implementation plan.

### 10.1 Files to change

**Shared schema / types**
- `packages/worker/src/prompts/shared.ts` — add `signalSchema`, `stageAExtractSchema`, widened `platformBriefSchema`, `mergedSignalsSchema`, `roleSectionsSchema`; keep legacy schemas exported.
- `packages/shared/src/` — if signal types are needed by api/web, add a `signals` module and re-export (per root CLAUDE.md §4 — shared shapes live in `shared/`).

**Stage A**
- `packages/worker/src/prompts/platform/{reddit,appstore,playstore,hackernews,producthunt,devto,website}/extract.ts` — 7 files.
- New `packages/worker/src/prompts/platform/_shared/signal-extraction-rules.ts` — one shared rule block imported by all 7, to prevent drift.
- `packages/worker/src/pipeline/stage-a-extract.ts` — new schema, `toLegacyExtract()` adapter, dual-write to `report_platform_briefs.extract`.

**Stage B**
- `packages/worker/src/prompts/platform/{...}/summarize.ts` — 7 files.
- `packages/worker/src/pipeline/stage-b-summarize.ts` — widened brief, `toLegacyBrief()`.

**Stage C**
- `packages/worker/src/prompts/cross/merge.ts` — multi-signal merge prompt.
- `packages/worker/src/pipeline/stage-c-merge.ts` — `mergedSignalsSchema`, code-side `confidence`, `toLegacyMerged()`.

**Stage D**
- `packages/worker/src/prompts/cross/synth.ts` — role-section prompt.
- `packages/worker/src/pipeline/stage-d-synth.ts` — role sections + extend `enrichSynthOutput` for `frequency`/`confidence`/`opportunity score`.

**Stage E**
- `packages/worker/src/prompts/cross/refine.ts` — role-section critique rules, balanced love/pain.
- `packages/worker/src/pipeline/stage-e-refine.ts` — refine role sections; louder fallback logging.

**Orchestration + persistence**
- `packages/worker/src/pipeline/run.ts` — thread new shapes; `report_pipeline_checkpoints` already supports JSONB checkpoints (stages `C`/`D`/`E` enum may need extending if checkpoint granularity changes).
- `packages/worker/src/pipeline/persist.ts` — upsert `report_role_sections` rows (one per `section_type`); keep all legacy table writes.

**Database**
- New `packages/api/src/db/schema/report-role-sections.ts` — `report_role_sections` table + `section_type` enum; re-export from `schema/index.ts`.
- Run `pnpm db:generate` then `pnpm db:migrate` — one additive migration, committed in the same commit as the schema change (api CLAUDE.md §6).

**API**
- `packages/api/src/controllers/reports/handlers/getSections.ts` — new handler, `auth: { permissions: [REPORTS_VIEW] }`.
- `packages/api/src/controllers/reports/index.ts` — mount it.
- `packages/api/src/services/reports.service.ts` — `getReportSections()` read function.

**Web** (Phase 5)
- `packages/web/src/` report view — six role dashboard components + new API client method.

### 10.2 Tests to add

- `stage-a-extract.test.ts` — new schema parses; `toLegacyExtract()` round-trips; love signals captured.
- `stage-b-summarize.test.ts` — widened brief; `toLegacyBrief()`.
- `stage-c-merge.test.ts` — all seven cluster types; `confidence` computed; `toLegacyMerged()`.
- `stage-d-synth.test.ts` — six role sections; grounding refs present; deterministic enrichment.
- `stage-e-refine.test.ts` — dedupe; balanced love/pain enforced; fallback path.
- `persist.test.ts` — `report_sections` written; legacy tables still written.
- New `signal-adapters.test.ts` — the three legacy adapters in isolation.

### 10.3 Backward-compatibility risks

| Risk | Mitigation |
|---|---|
| Stage B/C consume a changed extract shape and break | Legacy adapters (§3.3); each phase keeps the next stage on the old shape until its own phase. |
| Frontend breaks when tables change | No table is changed or dropped — only one table added. All 16 endpoints untouched. |
| Checkpoint resume across a deploy mid-pipeline | `report_pipeline_checkpoints` is keyed by stage; a schema change mid-run could mismatch. Mitigation: bump a `schema_version`; treat version-mismatched checkpoints as absent (re-run the stage). |
| LLM token budget grows (7 signal groups + 6 role sections) | Stage D/E `MAX_TOKENS` is 16000; role sections are larger. Measure; consider splitting Stage D per-role if it exceeds budget. |
| `pgbouncer` / pool limits under added writes | `report_sections` write is one extra upsert inside the existing `persistReport` transaction — negligible. |
| Cost increase per report | Each phase is measurable; Phase 1–2 add extraction breadth, not extra calls. Stage D may need per-role calls — decide in Phase 3 from real token counts. |

### 10.4 Rollout order

`Phase 1 → 2 → 3 → 4 → 5`, strictly. Each phase: branch, implement, test, verify a real end-to-end report locally, merge. Do not begin a phase before the previous is merged and a live report has been validated. Phases 1–4 are invisible to users (safe to ship continuously); Phase 5 is the visible launch of the role dashboards.

---

## Open decisions for the approver

1. **DB strategy** — **resolved:** Option A, the `report_role_sections` table (one row per `section_type`).
2. **`positioning_signals` at Stage A** — **resolved:** extracted at Stage A as a first-class signal, like every other type.
3. **Stage D call shape** — single call for all six role sections, or one call per role? Recommend deciding empirically in Phase 3 from token counts; default to single call.
4. **Legacy tab retirement** — keep signal-type tabs alongside role dashboards indefinitely, or retire them at the end of Phase 5? Recommend retire after validation.
