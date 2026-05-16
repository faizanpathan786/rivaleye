# Insight Quality Pipeline — Implementation Plan

**Date:** 2026-05-16
**Spec:** `docs/superpowers/specs/2026-05-16-insight-quality-design.md`
**Related:** `docs/superpowers/specs/2026-05-16-backend-wiring-design.md`
**Scope:** Replace the single-pass LLM clustering in `packages/worker/src/jobs/generate-report.ts` with a 4-stage, evidence-bound, goal-conditioned pipeline. Reddit only. MVP runs all stages on `deepseek/deepseek-v4-flash:free` via OpenRouter; stage 3 model is config-driven for future paid-tier upgrade to `anthropic/claude-sonnet-4`.

---

## Locked constraints (re-confirm before each phase)

- LLM provider: `@openrouter/sdk` only. Model env-configurable per stage; defaults to `deepseek/deepseek-v4-flash:free`.
- Single source: Reddit. No multi-platform branches.
- Output: must match `reportOutputSchema` in `@rivaleye/shared` exactly (snake_case wire shape per backend spec §1.4) AND carry the insight-spec internal fields (`painScore`, `scores`, `evidence.topQuotes`, etc.).
- **Never write a silent `DEFAULT_OUTPUT` fallback.** Failure modes always set `stage="failed"` + `error` + persist `meta.lastRaw` for debug. No empty-shaped success states.
- `<20` mentions → fail-fast pre-flight; no LLM calls made.
- Per-stage retry: 1 retry max. Second failure = hard fail with stage error.
- `reports.stage` column transitions: `queued → scraping → clustering → done` (or `failed`). Worker writes `stage` alongside legacy `status` per backend spec §1.5.

---

## Output shape reconciliation note

The insight spec (§8) defines a richer internal shape (camelCase, `painScore`, `topOpportunities`, etc.). The backend wiring spec (§1.4) defines the persisted `output` jsonb shape (snake_case PRD §10 keys).

**Resolution:** The pipeline produces the internal rich shape, then a final adapter in Phase 7 maps it to the persisted `reportOutputSchema` from `@rivaleye/shared`. Internal scoring fields are carried inside `pain_clusters[].scores` and `top_opportunities[].scores` (extend the shared schema to include them — additive only, no breaking renames). Synthetic post ids (`p001..p150`) are rewritten to `mentions.externalId` before persist.

If a conflict surfaces during Phase 0, the shared `reportOutputSchema` is authoritative; extend it before changing the pipeline.

---

# Phase 0 — Prompt files

**Goal:** Stand up the prompt module with typed template fns, one per stage. No pipeline wiring yet.

**Parallel-safe:** YES — all four prompt files are independent.

### Tasks

| # | File | Action | Acceptance | Parallel |
|---|---|---|---|---|
| 0.1 | `packages/worker/src/prompts/index.ts` | Create barrel re-exporting all stage prompt builders + the shared `PromptBuilder<T>` type. | `import { buildStage1Prompt, ... } from "../prompts"` resolves. | yes |
| 0.2 | `packages/worker/src/prompts/stage1-cluster.ts` | Export `buildStage1Prompt(input: Stage1Input): { system: string; user: string }`. System prompt embeds anti-generic + forced-specificity + stage-specific guard rails from insight spec §7. User prompt formats posts with synthetic `p001..p150` ids, competitor, category. Also emits voice-of-customer extraction rules from §4. | Snapshot test stub (no LLM call) verifies system contains key phrases ("Group by user pain, not feature", "p001"). Function pure. | yes |
| 0.3 | `packages/worker/src/prompts/stage2-score.ts` | Export `buildStage2Prompt(input: Stage2Input)`. Stage 2 is LLM-assisted for `intensity` + `specificity` ONLY; `frequency` and `recencyDays` are computed deterministically in the scoring module (Phase 1) and passed in. Prompt sends cluster descriptions + quotes + metadata (no post bodies) and asks for `{ clusterId, intensity: 1-5, specificity: 1-5 }[]`. | Prompt explicitly forbids body access; output schema documented in prompt header. | yes |
| 0.4 | `packages/worker/src/prompts/stage3-synthesize.ts` | Export `buildStage3Prompt(input: Stage3Input)` where `input.founderGoal: FounderGoal`. Internal `GOAL_VARIANTS` map provides per-goal emphasis strings per insight spec §5 table. System prompt sets default opinionated tone; the goal variant string is appended. Always emits all 10 PRD §10 sections; shrink-not-omit. Pin Top 3 Opportunities at top. | Each of 5 goal enum values produces a distinct user-prompt suffix. Generic-phrase blocklist (§7) included as literal banned list. | yes |
| 0.5 | `packages/worker/src/prompts/stage4-actions.ts` | Export `buildStage4Prompt(input: Stage4Input)` — goal-conditioned next-actions generator. Each action must cite ≥1 `clusterId`. | Prompt prohibits vague advice ("improve marketing"). Output 3–7 items. | yes |
| 0.6 | `packages/worker/src/prompts/shared.ts` | Export shared prompt fragments: `ANTI_GENERIC_RULES`, `BLOCKED_PHRASES`, `FOUNDER_LANGUAGE_RULES`, `EVIDENCE_RULES`. Stages 1–4 compose these. | Single source of truth for tone rules; no duplication across stage files. | yes |

---

# Phase 1 — Scoring module

**Goal:** Deterministic, unit-testable pain + opportunity scoring. No LLM calls.

**Parallel-safe:** YES with Phase 0.

### Tasks

| # | File | Action | Acceptance | Parallel |
|---|---|---|---|---|
| 1.1 | `packages/worker/src/scoring/pain-score.ts` | Export `computePainScore(input: { frequency, intensity, recencyDays, specificity }): number` using exact formula from insight spec §2. Also `computeClusterMetadata(evidencePostIds: string[], mentions: MentionRow[]): { frequency, recencyDays }`. | `bun test` covers: saturation at frequency≥10, recency cap at 365, weight sum = 1.0, output integer 0..100. | yes |
| 1.2 | `packages/worker/src/scoring/opportunity-score.ts` | Export `computeOpportunityScore({ marketPain, differentiation, evidenceCount }): number` using §3 formula. | Unit tests: top 3 selection order matches by score; ties broken by evidenceCount desc. | yes |
| 1.3 | `packages/worker/src/scoring/index.ts` | Barrel + shared types (`ClusterScores`, `OpportunityScores`). | Importable from pipeline orchestrator. | yes |

---

# Phase 2 — Stage 1 implementation (clustering)

**Goal:** Call LLM with stage-1 prompt, parse + Zod-validate, retry once.

**Parallel-safe:** Partial — depends on Phase 0.2 and Phase 7.1 (Zod schema). Internal subtasks sequential.

### Tasks

| # | File | Action | Acceptance |
|---|---|---|---|
| 2.1 | `packages/worker/src/pipeline/stage1.ts` | Export `runStage1(ctx: PipelineCtx): Promise<Stage1Output>`. Builds synthetic id map (`p001..p150` ↔ `mentions.externalId`), truncates bodies to `MAX_BODY_CHARS=800`, calls `buildStage1Prompt`, invokes `llm.call(stage1Model, system, user)`, strips fences, JSON-parses, validates against `stage1Schema` (Phase 7.1). On parse/schema fail → 1 retry with augmented prompt prepending validator error. | Returns `{ rawClusters: RawCluster[], voicePhrases: VoiceOfCustomerPhrase[], syntheticIdMap: Map<string,string> }`. Drops single-evidence clusters per spec §7. |
| 2.2 | `packages/worker/src/pipeline/stage1.ts` | Persist `syntheticIdMap` in-memory on `ctx`; never written to DB. | Map accessible to Phases 3–6. |

---

# Phase 3 — Stage 2 implementation (scoring)

**Goal:** Score and rank clusters. Combine deterministic metadata + LLM-rated intensity/specificity.

**Parallel-safe:** Sequential after Phase 2.

### Tasks

| # | File | Action | Acceptance |
|---|---|---|---|
| 3.1 | `packages/worker/src/pipeline/stage2.ts` | Export `runStage2(ctx, stage1Output, mentions): Promise<ScoredCluster[]>`. For each cluster: compute `{ frequency, recencyDays }` deterministically via `computeClusterMetadata`. Then single LLM call (`buildStage2Prompt`) returns `{ clusterId, intensity, specificity }[]`. Merge → `computePainScore`. Sort desc. | All clusters get scores. LLM output Zod-validated; retry once on fail. |
| 3.2 | `packages/worker/src/pipeline/stage2.ts` | Split top N=8 → `rankedClusters`; rest → `extraClusters` for `output.extraClusters`. | Output never loses clusters; just partitions them. |

---

# Phase 4 — Stage 3 implementation (synthesis)

**Goal:** Generate report sections from ranked clusters, conditioned on `founder_goal`. Pin Top 3 Opportunities.

**Parallel-safe:** Sequential after Phase 3.

### Tasks

| # | File | Action | Acceptance |
|---|---|---|---|
| 4.1 | `packages/worker/src/pipeline/stage3.ts` | Export `runStage3(ctx, rankedClusters, voicePhrases): Promise<Stage3Output>`. Reads `report.goal` (FounderGoal), `report.competitors[0]`, `report.category`. Calls `buildStage3Prompt` with goal variant. Uses `STAGE3_MODEL` env (default `deepseek/deepseek-v4-flash:free`, configurable to `anthropic/claude-sonnet-4`). | Stage 3 output Zod-validated against `stage3Schema`; retry once with augmented prompt + offending phrases echoed back on blocklist hit. |
| 4.2 | `packages/worker/src/pipeline/stage3.ts` | Compute opportunity scores via `computeOpportunityScore` using LLM-provided `differentiation` + cluster `marketPain` (max painScore across linked clusters) + `evidenceCount`. Sort opportunities; assign top 3 to `topOpportunities`. | `topOpportunities.length === 3` after evidence-binding (Phase 6); padded from full list if drops occur, else `meta.warnings += "few_opportunities"`. |
| 4.3 | `packages/worker/src/pipeline/stage3.ts` | Per-goal depth enforcement (e.g. `improve_positioning ⇒ positioningAngles.length >= 5`). On fail → retry once with stricter prompt. | Goal-conditional invariants enforced per insight spec §5 + §9. |

---

# Phase 5 — Stage 4 implementation (next actions)

**Goal:** Goal-conditioned, opinionated next-actions tied to cluster ids.

**Parallel-safe:** Sequential after Phase 4.

### Tasks

| # | File | Action | Acceptance |
|---|---|---|---|
| 5.1 | `packages/worker/src/pipeline/stage4.ts` | Export `runStage4(ctx, stage3Output): Promise<NextAction[]>`. Calls `buildStage4Prompt` with `founder_goal` + stage3 summary. Zod-validate output (3–7 items, each with `clusterIds.length >= 1`). Retry once on fail. | Every `NextAction.clusterIds[]` references an existing cluster id from stage 3 output. |

---

# Phase 6 — Evidence binding

**Goal:** Rewrite synthetic post ids to real `mentions.externalId`; enforce evidence integrity; enforce generic-phrase blocklist.

**Parallel-safe:** Sequential after Phase 5.

### Tasks

| # | File | Action | Acceptance |
|---|---|---|---|
| 6.1 | `packages/worker/src/pipeline/evidence-binding.ts` | Export `remapPostIds(output: InternalReportOutput, syntheticIdMap: Map<string,string>): InternalReportOutput`. Walks every `evidence.postIds[]` and `voicePhrases[].examplePostIds[]`. Unknown synthetic ids dropped + logged. | No `pNNN` strings survive in returned output. |
| 6.2 | `packages/worker/src/pipeline/evidence-binding.ts` | Export `validateEvidence(output, mentions): { output, warnings, dropped }`. Enforces per insight spec §9 evidence-level table: clusters need ≥2 postIds, opportunities ≥3, feature gaps ≥1, every cited postId exists in `mentions` for this `reportId`. Drop offending claims; log. If >20% claims dropped → throw `Stage3ValidationError` (caller decides retry vs hard-fail). | Returns adjusted output + dropped counts. Hard threshold enforced. |
| 6.3 | `packages/worker/src/pipeline/evidence-binding.ts` | Export `checkBlocklist(output): { ok: boolean, offending: string[] }`. Scans `executiveSummary` + each `painCluster.description` against `BLOCKED_PHRASES`. | Returns offending list for retry-augmented prompt construction. |

---

# Phase 7 — Quality gates + shared schema

**Goal:** Pre-flight gate; per-stage Zod schemas; final shape validation against `@rivaleye/shared`.

**Parallel-safe:** 7.1 and 7.2 are parallel after Phase 0. 7.3 sequential after 7.1.

### Tasks

| # | File | Action | Acceptance | Parallel |
|---|---|---|---|---|
| 7.1 | `packages/worker/src/pipeline/schemas.ts` | Define Zod schemas for each stage output: `stage1Schema`, `stage2Schema`, `stage3Schema`, `stage4Schema`. Internal camelCase shape per insight spec §8. | Each stage handler imports + parses against its schema. | yes |
| 7.2 | `packages/shared/src/schemas/report.ts` | Extend `reportOutputSchema` (per backend spec §1.4) additively: add optional `scores` on `painClusterSchema` and `opportunitySchema`; add optional `extra_clusters`, `voice_of_customer_phrases`, `meta` to `reportOutputSchema`. Add `meta.pipelineVersion`, `meta.modelTier`, `meta.error`, `meta.warnings`, `meta.lastRaw`. | `pnpm type-check` passes; existing legacy adapter unaffected. | yes |
| 7.3 | `packages/worker/src/pipeline/preflight.ts` | Export `preflightCheck(reportId, mentions): void` — throws `NotEnoughSignalError` when `mentions.length < 20`. Caller maps to `stage="failed"` + `error="not_enough_signal"` + helpful hint per insight spec §9. | Fail-fast before any LLM call. | yes after 7.1 |
| 7.4 | `packages/worker/src/pipeline/adapter.ts` | Export `toWireShape(internal: InternalReportOutput): ReportOutput` — maps camelCase internal shape → snake_case wire shape required by `reportOutputSchema`. Validates final output against `reportOutputSchema` (zod `.parse`, not `.safeParse` — fail loud). | Parse failure throws `FinalShapeError`; caller hard-fails the report. | seq after 7.2 |
| 7.5 | `packages/worker/src/pipeline/errors.ts` | Define typed errors: `NotEnoughSignalError`, `StageValidationError(stageNum, lastRaw)`, `FinalShapeError`, `EvidenceIntegrityError`. | All pipeline failures surface a typed error; never `throw new Error("...")`. | yes |

---

# Phase 8 — Pipeline orchestration

**Goal:** Rewrite `packages/worker/src/jobs/generate-report.ts` to call the 4 stages in order, updating `reports.stage` between phases.

**Parallel-safe:** Sequential after Phases 0–7.

### Tasks

| # | File | Action | Acceptance |
|---|---|---|---|
| 8.1 | `packages/worker/src/pipeline/run.ts` | Export `runInsightPipeline(reportId: string): Promise<ReportOutput>`. Sequence: load report row → load mentions → `preflightCheck` → set `stage="clustering"` → `runStage1` → `runStage2` → `runStage3` → `runStage4` → `remapPostIds` → `validateEvidence` → `checkBlocklist` (retry stage 3 once if hits) → `toWireShape` → return. | Each stage transition logged with `reportId`. `meta.pipelineVersion = "2026-05-16-multi-pass-v1"` stamped. |
| 8.2 | `packages/worker/src/jobs/generate-report.ts` | Replace entire handler body. New flow: try `runInsightPipeline(reportId)` → on success update `reports` with `output`, `stage="done"`, `status="completed"`, `updatedAt`. On `NotEnoughSignalError` → `stage="failed"`, `error="not_enough_signal"`, `output.meta = { error, hint }`, `status="failed"`. On `StageValidationError` / `FinalShapeError` / `EvidenceIntegrityError` → `stage="failed"`, `error=<typed>`, persist `output.meta.lastRaw`, `status="failed"`. Re-throw to let pg-boss record the failure. | **No `DEFAULT_OUTPUT` fallback anywhere.** Every failure path writes a typed `error` string + sets `stage="failed"`. All previous single-pass code deleted. |
| 8.3 | `packages/worker/src/llm/index.ts` | Centralize LLM client: `callLlm({ model, system, user, maxTokens? }): Promise<string>` reading `OPENROUTER_API_KEY`. Export `STAGE_MODELS = { stage1, stage2, stage3, stage4 }` resolved from env with deepseek defaults. `STAGE3_MODEL` env override exposes the future paid-tier swap. | Single point of LLM access; stages cannot bypass. |
| 8.4 | `packages/worker/src/queue.ts` | Confirm `GenerateReportJob` type unchanged; no new queue work. | No schema drift. |

---

# Phase 9 — Legacy code removal

**Goal:** Confirm api-side single-pass code path is gone; ensure it stays gone.

**Parallel-safe:** YES with all phases (audit-only).

### Tasks

| # | File | Action | Acceptance |
|---|---|---|---|
| 9.1 | `packages/api/src/services/report-generator.ts` | Confirm deleted per backend spec §5. If present, delete. | File does not exist. `grep -r "runReport" packages/api/src` returns empty. |
| 9.2 | `packages/api/src/controllers/reports/handlers/create-report.ts` | Confirm handler only validates + calls `reportsService.createReport` (which enqueues). No `getScraper` imports. No `callLlm` imports. | `grep -E "@rivaleye/scrapers|openrouter" packages/api/src` returns empty. |
| 9.3 | `packages/worker/src/jobs/generate-report.ts` | Confirm old `CLUSTER_SYSTEM_PROMPT`, `DEFAULT_OUTPUT`, `parseJsonSafe`, search-terms LLM call are removed (now in the pipeline module under Phase 8). | `grep "DEFAULT_OUTPUT" packages/worker/src` returns empty. |
| 9.4 | `packages/shared/src/types` | Mark `PainReportOutput` as deprecated alias of `ReportOutput`; remove from worker imports. | Worker no longer references the legacy shape. |

---

# Phase 10 — Verification

**Goal:** End-to-end smoke run + spec conformance check.

**Parallel-safe:** Sequential, final phase.

### Tasks

| # | File / Action | Acceptance |
|---|---|---|
| 10.1 | Seed a dev report row (`pnpm db:studio` or insert script) with `competitors=["Linear"]`, `category="project management"`, `goal="improve_positioning"`. Trigger scrape via api `POST /v1/reports`. | Row created with `stage="queued"`. |
| 10.2 | Run worker: `pnpm --filter @rivaleye/worker dev`. Observe stage transitions in DB: `queued → scraping → clustering → done`. | All transitions present; timestamps monotonic. |
| 10.3 | Inspect `reports.output` jsonb. Parse manually against `reportOutputSchema`. Confirm: `top_opportunities.length === 3`, every `pain_clusters[i].evidence.postIds[]` references a row in `mentions` for this report, no `pNNN` strings remain, `meta.pipelineVersion === "2026-05-16-multi-pass-v1"`. | Output validates. |
| 10.4 | Force-fail case: seed a report with a junk competitor that returns <20 mentions. | After scrape, report ends `stage="failed"`, `error="not_enough_signal"`, `output.meta.hint` present. **No empty cluster array masquerading as success.** |
| 10.5 | Goal-variant smoke: re-run with `goal="decide_mvp_features"`. Confirm `feature_gaps[]` items carry `priority` field; `positioning_angles` may be shorter. | Goal conditioning visible in diff between runs. |
| 10.6 | Blocklist smoke: temporarily inject a banned phrase in stage 3 mock → confirm retry triggers + final output has no banned phrase. | Retry path exercised. |
| 10.7 | `pnpm type-check` + `pnpm lint` from repo root. | Clean. |

---

## Phase summary

| Phase | Title | Tasks | Parallel-safe with prior |
|---|---|---|---|
| 0 | Prompt files | 6 | n/a (root) |
| 1 | Scoring module | 3 | yes (parallel with 0) |
| 2 | Stage 1 impl | 2 | no (needs 0, 7.1) |
| 3 | Stage 2 impl | 2 | no (needs 2) |
| 4 | Stage 3 impl | 3 | no (needs 3) |
| 5 | Stage 4 impl | 1 | no (needs 4) |
| 6 | Evidence binding | 3 | no (needs 5) |
| 7 | Quality gates + schema | 5 | partial (7.1/7.2/7.3/7.5 parallel; 7.4 seq) |
| 8 | Orchestration | 4 | no |
| 9 | Legacy removal | 4 | yes (audit only) |
| 10 | Verification | 7 | no (final) |

**Total phases:** 11 (0–10)
**Total tasks:** 40
**Parallel-safe phases:** 0, 1, 9 (fully); 7 (partially)

---

## Self-review notes

- Constraint check: OpenRouter + deepseek default, stage 3 model env-overridable → Phase 8.3. ✓
- Constraint check: No silent DEFAULT_OUTPUT → Phase 8.2 explicitly forbids; Phase 9.3 audits residue. ✓
- Constraint check: `<20` mentions fail-fast → Phase 7.3 throws before any LLM call. ✓
- Constraint check: per-stage retry-once → Phases 2.1, 3.1, 4.1, 5.1, 4.3 (blocklist retry routes back to 4.x). ✓
- Constraint check: final shape validates against shared `reportOutputSchema` → Phase 7.4 (`.parse`, not `.safeParse`). ✓
- Constraint check: `reports.stage` transitions → Phase 8.1 sets `clustering`; Phase 8.2 sets `done`/`failed`. Backend spec §1.5 mapping respected. ✓
- Constraint check: single source (Reddit) → no platform branching anywhere in plan. ✓
- Shape reconciliation: internal camelCase per insight §8 vs wire snake_case per backend §1.4 — handled by adapter in Phase 7.4; schema extension in 7.2 is additive only. ✓
- Risk: insight spec §8 (rich shape with `painScore`, `scores`) does not literally appear in backend spec §1.4. Mitigated by additive schema extension (7.2) — no breaking renames for frontend. Frontend consumers see snake_case keys; new optional fields ignored until UI uses them.
- Risk: blocklist retry routing — Phase 8.1 makes the retry an explicit branch back into `runStage3`, not a generic loop, so the retry budget remains "once per stage".
- Risk: stage 1 voice-of-customer extraction may bloat the prompt — kept in stage 1 because the spec attaches it there; if quality drops, splitting it into its own stage is a future refinement, not MVP.
- No code written. Plan only. ✓
