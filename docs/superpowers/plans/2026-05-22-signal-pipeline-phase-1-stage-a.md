# Signal-Centric Pipeline — Phase 1 (Stage A Signal Capture) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Stage A extract the seven first-class user-perception signal types (love, pain, gap, switch, pricing, feature, positioning) plus voice phrases and an evidence-quote pool for every platform, store them, and keep Stages B/C/D/E running unchanged via a legacy adapter.

**Architecture:** Stage A's LLM emits a new `stageAExtractSchema`. A pure `toLegacyExtract()` adapter derives the existing `PlatformExtract` shape so Stage B/C/D/E are untouched. The `report_platform_briefs.extract` JSONB column stores the legacy shape at its top level (so Stage C's `as PlatformExtract` cast keeps working) plus the full new extract under a `_signals` key. **No database migration in this phase.** Love signal is captured and persisted from day one; nothing downstream changes behavior.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Zod, Bun, `bun:test`, OpenRouter LLM client, Drizzle ORM. Worker package: `packages/worker`.

**Source spec:** `docs/architecture/15-signal-centric-pipeline-redesign.md` (sections 2, 3, 9 Phase 1, 10).

---

## File Map

**Create:**
- `packages/worker/src/pipeline/signal-adapters.ts` — `toLegacyExtract()`, `mergeStageAExtracts()`, `emptyStageAExtract()`
- `packages/worker/src/pipeline/signal-adapters.test.ts` — adapter tests
- `packages/worker/src/prompts/platform/_shared/signal-extraction-rules.ts` — `buildSignalSystemPrompt()` shared system-prompt builder
- `packages/worker/src/prompts/platform/_shared/signal-extraction-rules.test.ts` — shared-prompt tests
- `packages/worker/src/prompts/platform/{reddit,hackernews,devto,appstore,playstore,producthunt,website}/extract.test.ts` — 7 per-platform builder tests

**Modify:**
- `packages/worker/src/prompts/shared.ts` — add Stage A signal schemas + types (keep legacy schemas)
- `packages/worker/src/prompts/shared.test.ts` — add Stage A schema tests
- `packages/worker/src/prompts/platform/{reddit,hackernews,devto,appstore,playstore,producthunt,website}/extract.ts` — emit new schema
- `packages/worker/src/pipeline/stage-a-extract.ts` — new return type, builder type
- `packages/worker/src/pipeline/stage-a-extract.test.ts` — update for new shape
- `packages/worker/src/pg-runner/source-worker.ts` — merge new shape, dual-return, persist `_signals`

**Scope guard:** Do NOT touch Stage B, C, D, E prompts/runners, the DB schema, the API, or the web app in Phase 1.

---

## Execution Waves (parallelism)

Subagent-driven execution should dispatch in dependency order. Independent tasks in the same wave run as parallel subagents.

- **Wave 1 (parallel ×2):** Task 1, Task 3
- **Wave 2 (parallel ×8):** Task 2 (needs T1), Tasks 4–10 (need T1 + T3)
- **Wave 3:** Task 11 (needs T1, T4–T10)
- **Wave 4:** Task 12 (needs T2, T11)
- **Wave 5:** Task 13 (verification — needs T12)

Each subagent owns disjoint files, so Wave 2's eight subagents never edit the same file.

---

## Task 1: Add Stage A signal schemas to `shared.ts`

**Files:**
- Modify: `packages/worker/src/prompts/shared.ts`
- Modify: `packages/worker/src/prompts/shared.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/worker/src/prompts/shared.test.ts` (create the file with this content if it does not exist):

```typescript
import { describe, expect, it } from "bun:test";
import { stageAExtractSchema } from "./shared";

describe("stageAExtractSchema", () => {
  it("parses a full valid Stage A extract", () => {
    const parsed = stageAExtractSchema.parse({
      love_signals: [
        {
          title: "Fast onboarding",
          summary: "Users praise reaching first value in minutes.",
          sentiment: 0.8,
          strength_or_severity: 0.7,
          evidence_ids: ["reddit:1"],
          representative_quotes: [
            { author: "u/matt", text: "running before my coffee cooled", evidence_id: "reddit:1" },
          ],
          related_features: ["setup wizard"],
          user_segment: "solo devs",
        },
      ],
      pain_signals: [],
      gap_signals: [],
      switch_signals: [
        {
          title: "Eyeing Plivo",
          summary: "A user is pricing out Plivo.",
          sentiment: -0.4,
          strength_or_severity: 0.6,
          evidence_ids: ["reddit:2"],
          representative_quotes: [],
          related_features: [],
          user_segment: null,
          direction: "outbound",
          alternatives_mentioned: ["Plivo"],
        },
      ],
      pricing_signals: [
        {
          title: "Surprise surcharges",
          summary: "Carrier fees not shown upfront.",
          sentiment: -0.6,
          strength_or_severity: 0.8,
          evidence_ids: ["reddit:3"],
          representative_quotes: [],
          related_features: [],
          user_segment: null,
          tier_label: "Pay-as-you-go",
          quoted_price: "$0.0079/msg",
        },
      ],
      feature_signals: [
        {
          title: "Messaging API",
          summary: "Users discuss the messaging API quality.",
          sentiment: 0.2,
          strength_or_severity: 0.5,
          evidence_ids: ["reddit:4"],
          representative_quotes: [],
          related_features: [],
          user_segment: null,
          feature_name: "Messaging API",
          perception: "mixed",
        },
      ],
      voice_phrases: { positive: ["just works"], negative: ["too expensive"] },
      evidence_quotes: [
        {
          author: "u/matt",
          text: "running before my coffee cooled",
          evidence_id: "reddit:1",
          signal_type: "love",
          sentiment: 0.8,
        },
      ],
    });
    expect(parsed.love_signals.length).toBe(1);
    expect(parsed.switch_signals[0]?.direction).toBe("outbound");
    expect(parsed.pricing_signals[0]?.quoted_price).toBe("$0.0079/msg");
  });

  it("fills array defaults when signal groups are omitted", () => {
    const parsed = stageAExtractSchema.parse({
      pain_signals: [],
      voice_phrases: { positive: [], negative: [] },
    });
    expect(parsed.love_signals).toEqual([]);
    expect(parsed.feature_signals).toEqual([]);
    expect(parsed.positioning_signals).toEqual([]);
    expect(parsed.evidence_quotes).toEqual([]);
  });

  it("rejects sentiment outside -1..1", () => {
    expect(() =>
      stageAExtractSchema.parse({
        love_signals: [
          {
            title: "x",
            summary: "y",
            sentiment: 2,
            strength_or_severity: 0.5,
          },
        ],
        voice_phrases: { positive: [], negative: [] },
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/worker && bun test src/prompts/shared.test.ts`
Expected: FAIL — `stageAExtractSchema` is not exported from `./shared`.

- [ ] **Step 3: Add the schemas to `shared.ts`**

In `packages/worker/src/prompts/shared.ts`, immediately after the existing `switchingDirectionSchema` declaration (currently line 13), insert:

```typescript
export const stageASignalSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  sentiment: z.number().min(-1).max(1),
  strength_or_severity: z.number().min(0).max(1),
  evidence_ids: z.array(z.string()).default([]),
  representative_quotes: z
    .array(
      z.object({
        author: z.string(),
        text: z.string().min(1),
        evidence_id: z.string(),
      }),
    )
    .default([]),
  related_features: z.array(z.string()).default([]),
  user_segment: z.string().nullable().default(null),
});

export const stageASwitchSignalSchema = stageASignalSchema.extend({
  direction: switchingDirectionSchema,
  alternatives_mentioned: z.array(z.string()).default([]),
});

export const stageAPricingSignalSchema = stageASignalSchema.extend({
  tier_label: z.string().nullable().default(null),
  quoted_price: z.string().nullable().default(null),
});

export const stageAFeatureSignalSchema = stageASignalSchema.extend({
  feature_name: z.string().min(1),
  perception: z.enum(["loved", "mixed", "criticized"]),
});

export const stageAPositioningSignalSchema = stageASignalSchema.extend({
  angle: z.string().min(1),
  against: z.string().nullable().default(null),
  audience: z.string().nullable().default(null),
});

export const evidenceQuoteSchema = z.object({
  author: z.string(),
  text: z.string().min(1),
  evidence_id: z.string(),
  signal_type: z.enum(["love", "pain", "gap", "switch", "pricing", "feature", "positioning"]),
  sentiment: z.number().min(-1).max(1).nullable().default(null),
});

export const stageAExtractSchema = z.object({
  love_signals: z.array(stageASignalSchema).default([]),
  pain_signals: z.array(stageASignalSchema).default([]),
  gap_signals: z.array(stageASignalSchema).default([]),
  switch_signals: z.array(stageASwitchSignalSchema).default([]),
  pricing_signals: z.array(stageAPricingSignalSchema).default([]),
  feature_signals: z.array(stageAFeatureSignalSchema).default([]),
  positioning_signals: z.array(stageAPositioningSignalSchema).default([]),
  voice_phrases: z.object({
    positive: z.array(z.string()).default([]),
    negative: z.array(z.string()).default([]),
  }),
  evidence_quotes: z.array(evidenceQuoteSchema).default([]),
});
```

Then, alongside the existing `export type PlatformExtract = ...` block (currently near line 241), add:

```typescript
export type StageASignal = z.infer<typeof stageASignalSchema>;
export type StageASwitchSignal = z.infer<typeof stageASwitchSignalSchema>;
export type StageAPricingSignal = z.infer<typeof stageAPricingSignalSchema>;
export type StageAFeatureSignal = z.infer<typeof stageAFeatureSignalSchema>;
export type StageAPositioningSignal = z.infer<typeof stageAPositioningSignalSchema>;
export type EvidenceQuote = z.infer<typeof evidenceQuoteSchema>;
export type StageAExtract = z.infer<typeof stageAExtractSchema>;
```

Do not modify or remove `platformExtractSchema`, `platformBriefSchema`, `mergedClustersSchema`, or `synthOutputSchema`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/worker && bun test src/prompts/shared.test.ts`
Expected: PASS — 3 tests pass.

- [ ] **Step 5: Type-check**

Run: `cd packages/worker && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/worker/src/prompts/shared.ts packages/worker/src/prompts/shared.test.ts
git commit -m "feat(worker): add Stage A signal schemas (love/pain/gap/switch/pricing/feature)"
```

---

## Task 2: Create signal adapters

**Files:**
- Create: `packages/worker/src/pipeline/signal-adapters.ts`
- Create: `packages/worker/src/pipeline/signal-adapters.test.ts`

Depends on Task 1.

- [ ] **Step 1: Write the failing test**

Create `packages/worker/src/pipeline/signal-adapters.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { emptyStageAExtract, mergeStageAExtracts, toLegacyExtract } from "./signal-adapters";
import type { StageAExtract } from "../prompts/shared";

function signal(over: Partial<StageAExtract["pain_signals"][number]> = {}) {
  return {
    title: "Title",
    summary: "Summary text.",
    sentiment: -0.5,
    strength_or_severity: 0.6,
    evidence_ids: ["e1"],
    representative_quotes: [],
    related_features: [],
    user_segment: null,
    ...over,
  };
}

describe("toLegacyExtract", () => {
  it("maps pain_signals to complaints and gap_signals to features_requested", () => {
    const extract: StageAExtract = {
      ...emptyStageAExtract(),
      pain_signals: [signal({ summary: "sync breaks", strength_or_severity: 0.9, evidence_ids: ["p1"] })],
      gap_signals: [signal({ title: "recurring tasks", evidence_ids: ["g1"] })],
    };
    const legacy = toLegacyExtract(extract);
    expect(legacy.complaints).toEqual([{ text: "sync breaks", severity: 0.9, evidence_ids: ["p1"] }]);
    expect(legacy.features_requested).toEqual([{ feature: "recurring tasks", evidence_ids: ["g1"] }]);
  });

  it("maps switch_signals using the first non-empty alternative as competitor", () => {
    const extract: StageAExtract = {
      ...emptyStageAExtract(),
      switch_signals: [
        { ...signal({ title: "leaving" }), direction: "outbound", alternatives_mentioned: ["", "Plivo"] },
      ],
    };
    const legacy = toLegacyExtract(extract);
    expect(legacy.switching_signals[0]).toEqual({
      direction: "outbound",
      competitor: "Plivo",
      evidence_ids: ["e1"],
    });
  });

  it("falls back to the switch signal title when no alternative is named", () => {
    const extract: StageAExtract = {
      ...emptyStageAExtract(),
      switch_signals: [
        { ...signal({ title: "evaluating options" }), direction: "outbound", alternatives_mentioned: [] },
      ],
    };
    expect(toLegacyExtract(extract).switching_signals[0]?.competitor).toBe("evaluating options");
  });

  it("maps evidence_quotes to notable_quotes", () => {
    const extract: StageAExtract = {
      ...emptyStageAExtract(),
      evidence_quotes: [
        { author: "u/x", text: "great tool", evidence_id: "e9", signal_type: "love", sentiment: 0.8 },
      ],
    };
    expect(toLegacyExtract(extract).notable_quotes).toEqual([
      { author: "u/x", text: "great tool", evidence_id: "e9" },
    ]);
  });

  it("produces a schema-valid legacy extract", async () => {
    const { platformExtractSchema } = await import("../prompts/shared");
    const legacy = toLegacyExtract({
      ...emptyStageAExtract(),
      pain_signals: [signal()],
    });
    expect(() => platformExtractSchema.parse(legacy)).not.toThrow();
  });
});

describe("mergeStageAExtracts", () => {
  it("concatenates every signal group across batches", () => {
    const a: StageAExtract = { ...emptyStageAExtract(), love_signals: [signal({ title: "A" })] };
    const b: StageAExtract = { ...emptyStageAExtract(), love_signals: [signal({ title: "B" })] };
    const merged = mergeStageAExtracts([a, b]);
    expect(merged.love_signals.map((s) => s.title)).toEqual(["A", "B"]);
  });

  it("merges voice_phrases positive and negative", () => {
    const a: StageAExtract = { ...emptyStageAExtract(), voice_phrases: { positive: ["x"], negative: [] } };
    const b: StageAExtract = { ...emptyStageAExtract(), voice_phrases: { positive: [], negative: ["y"] } };
    const merged = mergeStageAExtracts([a, b]);
    expect(merged.voice_phrases).toEqual({ positive: ["x"], negative: ["y"] });
  });

  it("returns an empty extract for an empty input array", () => {
    expect(mergeStageAExtracts([])).toEqual(emptyStageAExtract());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/worker && bun test src/pipeline/signal-adapters.test.ts`
Expected: FAIL — `./signal-adapters` does not exist.

- [ ] **Step 3: Create `signal-adapters.ts`**

Create `packages/worker/src/pipeline/signal-adapters.ts`:

```typescript
import type { PlatformExtract, StageAExtract } from "../prompts/shared";

export function emptyStageAExtract(): StageAExtract {
  return {
    love_signals: [],
    pain_signals: [],
    gap_signals: [],
    switch_signals: [],
    pricing_signals: [],
    feature_signals: [],
    positioning_signals: [],
    voice_phrases: { positive: [], negative: [] },
    evidence_quotes: [],
  };
}

export function mergeStageAExtracts(extracts: StageAExtract[]): StageAExtract {
  return {
    love_signals: extracts.flatMap((e) => e.love_signals),
    pain_signals: extracts.flatMap((e) => e.pain_signals),
    gap_signals: extracts.flatMap((e) => e.gap_signals),
    switch_signals: extracts.flatMap((e) => e.switch_signals),
    pricing_signals: extracts.flatMap((e) => e.pricing_signals),
    feature_signals: extracts.flatMap((e) => e.feature_signals),
    positioning_signals: extracts.flatMap((e) => e.positioning_signals),
    voice_phrases: {
      positive: extracts.flatMap((e) => e.voice_phrases.positive),
      negative: extracts.flatMap((e) => e.voice_phrases.negative),
    },
    evidence_quotes: extracts.flatMap((e) => e.evidence_quotes),
  };
}

export function toLegacyExtract(e: StageAExtract): PlatformExtract {
  return {
    complaints: e.pain_signals.map((s) => ({
      text: s.summary,
      severity: s.strength_or_severity,
      evidence_ids: s.evidence_ids,
    })),
    features_requested: e.gap_signals.map((s) => ({
      feature: s.title,
      evidence_ids: s.evidence_ids,
    })),
    pricing_signals: e.pricing_signals.map((s) => ({
      note: s.summary,
      evidence_ids: s.evidence_ids,
    })),
    switching_signals: e.switch_signals.map((s) => ({
      direction: s.direction,
      competitor: s.alternatives_mentioned.find((a) => a.length > 0) ?? s.title,
      evidence_ids: s.evidence_ids,
    })),
    voice_phrases: {
      positive: e.voice_phrases.positive,
      negative: e.voice_phrases.negative,
    },
    notable_quotes: e.evidence_quotes.map((q) => ({
      author: q.author,
      text: q.text,
      evidence_id: q.evidence_id,
    })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/worker && bun test src/pipeline/signal-adapters.test.ts`
Expected: PASS — all tests pass.

- [ ] **Step 5: Type-check**

Run: `cd packages/worker && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/worker/src/pipeline/signal-adapters.ts packages/worker/src/pipeline/signal-adapters.test.ts
git commit -m "feat(worker): add Stage A signal adapters (legacy bridge, merge, empty)"
```

---

## Task 3: Create the shared signal-extraction prompt module

**Files:**
- Create: `packages/worker/src/prompts/platform/_shared/signal-extraction-rules.ts`
- Create: `packages/worker/src/prompts/platform/_shared/signal-extraction-rules.test.ts`

No dependency on other tasks (returns a plain string). Runs in Wave 1.

- [ ] **Step 1: Write the failing test**

Create `packages/worker/src/prompts/platform/_shared/signal-extraction-rules.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { buildSignalSystemPrompt } from "./signal-extraction-rules";

describe("buildSignalSystemPrompt", () => {
  const prompt = buildSignalSystemPrompt("Reddit posts and comment threads");

  it("interpolates the source noun", () => {
    expect(prompt).toContain("Reddit posts and comment threads");
  });

  it("requires every signal group key", () => {
    for (const key of [
      "love_signals",
      "pain_signals",
      "gap_signals",
      "switch_signals",
      "pricing_signals",
      "feature_signals",
      "positioning_signals",
      "voice_phrases",
      "evidence_quotes",
    ]) {
      expect(prompt).toContain(key);
    }
  });

  it("instructs equal weight for love and pain", () => {
    expect(prompt).toContain("EQUAL attention");
  });

  it("forbids markdown fences", () => {
    expect(prompt).toContain("No prose, no markdown fences");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/worker && bun test src/prompts/platform/_shared/signal-extraction-rules.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `signal-extraction-rules.ts`**

Create `packages/worker/src/prompts/platform/_shared/signal-extraction-rules.ts`:

```typescript
/**
 * Shared Stage A system prompt. Each platform passes a source noun
 * (e.g. "Reddit posts and comment threads") and reuses this body so the
 * seven platform prompts never drift apart.
 */
export function buildSignalSystemPrompt(sourceNoun: string): string {
  return `You are a competitor-perception analyst extracting user-perception signals from ${sourceNoun}.
You will receive a list of items each labelled with a stable id.

RivalEye captures what users really think about a competitor: what they LOVE, what they find PAINFUL, what they WISH existed, and who is ready to SWITCH. Give love and pain EQUAL attention — never bias toward complaints.

Return ONE JSON object matching this exact shape (all keys required, never rename or omit):
{
  "love_signals":    [{ "title": "3-6 word label", "summary": "1-2 sentences", "sentiment": 0.8, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [{ "author": "string", "text": "verbatim", "evidence_id": "id1" }], "related_features": ["feature name"], "user_segment": null }],
  "pain_signals":    [{ "title": "...", "summary": "...", "sentiment": -0.7, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [], "related_features": [], "user_segment": null }],
  "gap_signals":     [{ "title": "...", "summary": "...", "sentiment": -0.3, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [], "related_features": [], "user_segment": null }],
  "switch_signals":  [{ "title": "...", "summary": "...", "sentiment": -0.4, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [], "related_features": [], "user_segment": null, "direction": "inbound|outbound", "alternatives_mentioned": ["competitor name"] }],
  "pricing_signals": [{ "title": "...", "summary": "...", "sentiment": -0.2, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [], "related_features": [], "user_segment": null, "tier_label": null, "quoted_price": null }],
  "feature_signals": [{ "title": "...", "summary": "...", "sentiment": 0.0, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [], "related_features": [], "user_segment": null, "feature_name": "string", "perception": "loved|mixed|criticized" }],
  "positioning_signals": [{ "title": "...", "summary": "...", "sentiment": 0.0, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [], "related_features": [], "user_segment": null, "angle": "the framing users use", "against": null, "audience": null }],
  "voice_phrases":   { "positive": ["phrase"], "negative": ["phrase"] },
  "evidence_quotes": [{ "author": "string", "text": "verbatim under 200 chars", "evidence_id": "id1", "signal_type": "love|pain|gap|switch|pricing|feature|positioning", "sentiment": null }]
}

Rules:
- love_signals: what users praise, value, or stay for. This is first-class — extract it as carefully as pain.
- pain_signals: a specific product pain — what breaks, who is affected, concretely.
- gap_signals: a capability users ask for but the product lacks. NOT "where can I find an alternative" (that is a switch signal).
- switch_signals: a user evaluating, leaving, or arriving from a named competing product. Put named products in alternatives_mentioned.
- pricing_signals: how users perceive pricing and value. Put verbatim prices in quoted_price when stated.
- feature_signals: named product features users discuss. perception = loved | mixed | criticized.
- positioning_signals: how users talk about the competitor and category — their language, category perception, competitor promise vs. reality, objections, comparison framing. angle = the framing; against = the competitor promise/weakness it exposes.
- sentiment: -1 (very negative) to 1 (very positive). strength_or_severity: 0 (weak) to 1 (intense).
- evidence_ids: use ONLY the id labels provided; never invent ids. The array length is the true mention count — never truncate or sample.
- representative_quotes: 1-3 verbatim user quotes, under 200 chars each. Real user text, never a paraphrase.
- evidence_quotes: a BALANCED pool of the most telling verbatim quotes across all signal types — capture love quotes as well as pain quotes.
- voice_phrases: 1-3 word phrases users actually typed. Authentic language only — no paraphrasing.
- related_features / user_segment: fill only when stated in the source; otherwise [] / null.
- If a section has no signal, return an empty array — never omit the key. Never invent data.
- Return ONLY the JSON object. No prose, no markdown fences.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/worker && bun test src/prompts/platform/_shared/signal-extraction-rules.test.ts`
Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/prompts/platform/_shared/
git commit -m "feat(worker): add shared Stage A signal-extraction system prompt"
```

---

## Tasks 4–9: Rewrite the feedback-platform extract prompts

Tasks 4–9 are structurally identical: each swaps the platform's hand-written `SYSTEM` constant for `buildSignalSystemPrompt(<noun>)`, swaps the schema to `stageAExtractSchema`, leaves the existing user-message builder and `oneLine`/`truncate` helper untouched, and adds a per-platform test file. They touch disjoint files and run as parallel subagents.

### Task 4: Rewrite `reddit/extract.ts`

**Files:**
- Modify: `packages/worker/src/prompts/platform/reddit/extract.ts`
- Create: `packages/worker/src/prompts/platform/reddit/extract.test.ts`

Depends on Task 1 + Task 3.

- [ ] **Step 1: Write the failing test**

Create `packages/worker/src/prompts/platform/reddit/extract.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { buildRedditExtract } from "./extract";
import { stageAExtractSchema } from "../../shared";

const ctx = {
  reportId: "r1",
  competitor: "Twilio",
  category: "Messaging",
  audience: null,
  goal: "find_user_pain",
};

describe("buildRedditExtract", () => {
  it("returns the Stage A signal schema", () => {
    const built = buildRedditExtract({ ctx, posts: [] });
    expect(built.schema).toBe(stageAExtractSchema);
  });

  it("system prompt gives love equal weight and lists signal groups", () => {
    const built = buildRedditExtract({ ctx, posts: [] });
    expect(built.system).toContain("EQUAL attention");
    expect(built.system).toContain("love_signals");
  });

  it("user message keeps the relevance filter and competitor", () => {
    const built = buildRedditExtract({ ctx, posts: [{ id: "p1", score: 5, body: "hi" }] });
    expect(built.user).toContain("RELEVANCE FILTER");
    expect(built.user).toContain("Twilio");
    expect(built.user).toContain("id=p1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/worker && bun test src/prompts/platform/reddit/extract.test.ts`
Expected: FAIL — `built.schema` is still `platformExtractSchema`, not `stageAExtractSchema`.

- [ ] **Step 3: Rewrite `reddit/extract.ts`**

Replace the entire contents of `packages/worker/src/prompts/platform/reddit/extract.ts` with:

```typescript
import { stageAExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";
import { buildSignalSystemPrompt } from "../_shared/signal-extraction-rules";

const SYSTEM = buildSignalSystemPrompt("Reddit posts and comment threads");

export interface RedditExtractInput {
  ctx: PipelineCtx;
  posts: Array<{ id: string; score: number | null; body: string }>;
}

export function buildRedditExtract(input: RedditExtractInput): {
  system: string;
  user: string;
  schema: typeof stageAExtractSchema;
} {
  const postBlock = input.posts
    .map((p) => `- id=${p.id} | score=${p.score ?? 0} | ${truncate(p.body, 1500)}`)
    .join("\n");
  const user = `RELEVANCE FILTER: Only extract signals from posts discussing ${input.ctx.competitor} as a software product in the ${input.ctx.category} category. If a post uses the competitor name as a generic word or discusses an unrelated product, person, or topic, skip that post entirely — extract no signals from it.

Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

Reddit posts and comment threads (id-labelled):
${postBlock}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: stageAExtractSchema };
}

function truncate(s: string, max: number): string {
  return s.replace(/\s+/g, " ").trim().slice(0, max);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/worker && bun test src/prompts/platform/reddit/extract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/prompts/platform/reddit/extract.ts packages/worker/src/prompts/platform/reddit/extract.test.ts
git commit -m "feat(worker): reddit Stage A emits signal-centric extract"
```

### Task 5: Rewrite `hackernews/extract.ts`

**Files:**
- Modify: `packages/worker/src/prompts/platform/hackernews/extract.ts`
- Create: `packages/worker/src/prompts/platform/hackernews/extract.test.ts`

Depends on Task 1 + Task 3.

- [ ] **Step 1: Write the failing test**

Create `packages/worker/src/prompts/platform/hackernews/extract.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { buildHackerNewsExtract } from "./extract";
import { stageAExtractSchema } from "../../shared";

const ctx = {
  reportId: "r1",
  competitor: "Twilio",
  category: "Messaging",
  audience: null,
  goal: "find_user_pain",
};

describe("buildHackerNewsExtract", () => {
  it("returns the Stage A signal schema", () => {
    expect(buildHackerNewsExtract({ ctx, posts: [] }).schema).toBe(stageAExtractSchema);
  });

  it("system prompt gives love equal weight", () => {
    expect(buildHackerNewsExtract({ ctx, posts: [] }).system).toContain("EQUAL attention");
  });

  it("user message id-labels posts", () => {
    const built = buildHackerNewsExtract({ ctx, posts: [{ id: "h1", score: 10, body: "hi" }] });
    expect(built.user).toContain("id=h1");
    expect(built.user).toContain("Twilio");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/worker && bun test src/prompts/platform/hackernews/extract.test.ts`
Expected: FAIL — schema mismatch.

- [ ] **Step 3: Rewrite `hackernews/extract.ts`**

Replace the entire contents of `packages/worker/src/prompts/platform/hackernews/extract.ts` with:

```typescript
import { stageAExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";
import { buildSignalSystemPrompt } from "../_shared/signal-extraction-rules";

const SYSTEM = buildSignalSystemPrompt("Hacker News stories and comments");

export interface HackerNewsExtractInput {
  ctx: PipelineCtx;
  posts: Array<{ id: string; score: number | null; body: string }>;
}

export function buildHackerNewsExtract(input: HackerNewsExtractInput): {
  system: string;
  user: string;
  schema: typeof stageAExtractSchema;
} {
  const postBlock = input.posts
    .map((p) => `- id=${p.id} | score=${p.score ?? "n/a"} | ${oneLine(p.body)}`)
    .join("\n");
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

Hacker News posts (id-labelled):
${postBlock}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: stageAExtractSchema };
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 1200);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/worker && bun test src/prompts/platform/hackernews/extract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/prompts/platform/hackernews/extract.ts packages/worker/src/prompts/platform/hackernews/extract.test.ts
git commit -m "feat(worker): hackernews Stage A emits signal-centric extract"
```

### Task 6: Rewrite `devto/extract.ts`

**Files:**
- Modify: `packages/worker/src/prompts/platform/devto/extract.ts`
- Create: `packages/worker/src/prompts/platform/devto/extract.test.ts`

Depends on Task 1 + Task 3.

- [ ] **Step 1: Write the failing test**

Create `packages/worker/src/prompts/platform/devto/extract.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { buildDevToExtract } from "./extract";
import { stageAExtractSchema } from "../../shared";

const ctx = {
  reportId: "r1",
  competitor: "Twilio",
  category: "Messaging",
  audience: null,
  goal: "find_user_pain",
};

describe("buildDevToExtract", () => {
  it("returns the Stage A signal schema", () => {
    expect(buildDevToExtract({ ctx, posts: [] }).schema).toBe(stageAExtractSchema);
  });

  it("system prompt gives love equal weight", () => {
    expect(buildDevToExtract({ ctx, posts: [] }).system).toContain("EQUAL attention");
  });

  it("user message id-labels posts", () => {
    const built = buildDevToExtract({ ctx, posts: [{ id: "d1", score: 3, body: "hi" }] });
    expect(built.user).toContain("id=d1");
    expect(built.user).toContain("Twilio");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/worker && bun test src/prompts/platform/devto/extract.test.ts`
Expected: FAIL — schema mismatch.

- [ ] **Step 3: Rewrite `devto/extract.ts`**

Replace the entire contents of `packages/worker/src/prompts/platform/devto/extract.ts` with:

```typescript
import { stageAExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";
import { buildSignalSystemPrompt } from "../_shared/signal-extraction-rules";

const SYSTEM = buildSignalSystemPrompt("Dev.to articles and comments");

export interface DevToExtractInput {
  ctx: PipelineCtx;
  posts: Array<{ id: string; score: number | null; body: string }>;
}

export function buildDevToExtract(input: DevToExtractInput): {
  system: string;
  user: string;
  schema: typeof stageAExtractSchema;
} {
  const postBlock = input.posts
    .map((p) => `- id=${p.id} | score=${p.score ?? "n/a"} | ${oneLine(p.body)}`)
    .join("\n");
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

Dev.to posts (id-labelled):
${postBlock}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: stageAExtractSchema };
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 500);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/worker && bun test src/prompts/platform/devto/extract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/prompts/platform/devto/extract.ts packages/worker/src/prompts/platform/devto/extract.test.ts
git commit -m "feat(worker): devto Stage A emits signal-centric extract"
```

### Task 7: Rewrite `appstore/extract.ts`

**Files:**
- Modify: `packages/worker/src/prompts/platform/appstore/extract.ts`
- Create: `packages/worker/src/prompts/platform/appstore/extract.test.ts`

Depends on Task 1 + Task 3.

- [ ] **Step 1: Write the failing test**

Create `packages/worker/src/prompts/platform/appstore/extract.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { buildAppStoreExtract } from "./extract";
import { stageAExtractSchema } from "../../shared";

const ctx = {
  reportId: "r1",
  competitor: "Notion",
  category: "productivity",
  audience: null,
  goal: "find_user_pain",
};

describe("buildAppStoreExtract", () => {
  it("returns the Stage A signal schema", () => {
    expect(buildAppStoreExtract({ ctx, reviews: [] }).schema).toBe(stageAExtractSchema);
  });

  it("system prompt gives love equal weight", () => {
    expect(buildAppStoreExtract({ ctx, reviews: [] }).system).toContain("EQUAL attention");
  });

  it("user message id-labels reviews with rating", () => {
    const built = buildAppStoreExtract({ ctx, reviews: [{ id: "a1", rating: 5, body: "great" }] });
    expect(built.user).toContain("id=a1");
    expect(built.user).toContain("rating=5/5");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/worker && bun test src/prompts/platform/appstore/extract.test.ts`
Expected: FAIL — schema mismatch.

- [ ] **Step 3: Rewrite `appstore/extract.ts`**

Replace the entire contents of `packages/worker/src/prompts/platform/appstore/extract.ts` with:

```typescript
import { stageAExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";
import { buildSignalSystemPrompt } from "../_shared/signal-extraction-rules";

const SYSTEM = buildSignalSystemPrompt("Apple App Store reviews");

export interface AppStoreExtractInput {
  ctx: PipelineCtx;
  reviews: Array<{ id: string; rating: number; body: string }>;
}

export function buildAppStoreExtract(input: AppStoreExtractInput): {
  system: string;
  user: string;
  schema: typeof stageAExtractSchema;
} {
  const reviewBlock = input.reviews
    .map((r) => `- id=${r.id} | rating=${r.rating}/5 | ${oneLine(r.body)}`)
    .join("\n");
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

App Store reviews (id-labelled):
${reviewBlock}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: stageAExtractSchema };
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 1200);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/worker && bun test src/prompts/platform/appstore/extract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/prompts/platform/appstore/extract.ts packages/worker/src/prompts/platform/appstore/extract.test.ts
git commit -m "feat(worker): appstore Stage A emits signal-centric extract"
```

### Task 8: Rewrite `playstore/extract.ts`

**Files:**
- Modify: `packages/worker/src/prompts/platform/playstore/extract.ts`
- Create: `packages/worker/src/prompts/platform/playstore/extract.test.ts`

Depends on Task 1 + Task 3.

- [ ] **Step 1: Write the failing test**

Create `packages/worker/src/prompts/platform/playstore/extract.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { buildPlayStoreExtract } from "./extract";
import { stageAExtractSchema } from "../../shared";

const ctx = {
  reportId: "r1",
  competitor: "Notion",
  category: "productivity",
  audience: null,
  goal: "find_user_pain",
};

describe("buildPlayStoreExtract", () => {
  it("returns the Stage A signal schema", () => {
    expect(buildPlayStoreExtract({ ctx, reviews: [] }).schema).toBe(stageAExtractSchema);
  });

  it("system prompt gives love equal weight", () => {
    expect(buildPlayStoreExtract({ ctx, reviews: [] }).system).toContain("EQUAL attention");
  });

  it("user message id-labels reviews with rating", () => {
    const built = buildPlayStoreExtract({ ctx, reviews: [{ id: "g1", rating: 4, body: "ok" }] });
    expect(built.user).toContain("id=g1");
    expect(built.user).toContain("rating=4/5");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/worker && bun test src/prompts/platform/playstore/extract.test.ts`
Expected: FAIL — schema mismatch.

- [ ] **Step 3: Rewrite `playstore/extract.ts`**

Replace the entire contents of `packages/worker/src/prompts/platform/playstore/extract.ts` with:

```typescript
import { stageAExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";
import { buildSignalSystemPrompt } from "../_shared/signal-extraction-rules";

const SYSTEM = buildSignalSystemPrompt("Google Play Store reviews");

export interface PlayStoreExtractInput {
  ctx: PipelineCtx;
  reviews: Array<{ id: string; rating: number; body: string }>;
}

export function buildPlayStoreExtract(input: PlayStoreExtractInput): {
  system: string;
  user: string;
  schema: typeof stageAExtractSchema;
} {
  const reviewBlock = input.reviews
    .map((r) => `- id=${r.id} | rating=${r.rating}/5 | ${oneLine(r.body)}`)
    .join("\n");
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

Google Play Store reviews (id-labelled):
${reviewBlock}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: stageAExtractSchema };
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 1200);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/worker && bun test src/prompts/platform/playstore/extract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/prompts/platform/playstore/extract.ts packages/worker/src/prompts/platform/playstore/extract.test.ts
git commit -m "feat(worker): playstore Stage A emits signal-centric extract"
```

### Task 9: Rewrite `producthunt/extract.ts`

**Files:**
- Modify: `packages/worker/src/prompts/platform/producthunt/extract.ts`
- Create: `packages/worker/src/prompts/platform/producthunt/extract.test.ts`

Depends on Task 1 + Task 3.

- [ ] **Step 1: Write the failing test**

Create `packages/worker/src/prompts/platform/producthunt/extract.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { buildProductHuntExtract } from "./extract";
import { stageAExtractSchema } from "../../shared";

const ctx = {
  reportId: "r1",
  competitor: "Notion",
  category: "productivity",
  audience: null,
  goal: "find_user_pain",
};

describe("buildProductHuntExtract", () => {
  it("returns the Stage A signal schema", () => {
    expect(buildProductHuntExtract({ ctx, reviews: [] }).schema).toBe(stageAExtractSchema);
  });

  it("system prompt gives love equal weight", () => {
    expect(buildProductHuntExtract({ ctx, reviews: [] }).system).toContain("EQUAL attention");
  });

  it("user message id-labels items with votes", () => {
    const built = buildProductHuntExtract({ ctx, reviews: [{ id: "ph1", rating: 12, body: "nice" }] });
    expect(built.user).toContain("id=ph1");
    expect(built.user).toContain("votes=12");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/worker && bun test src/prompts/platform/producthunt/extract.test.ts`
Expected: FAIL — schema mismatch.

- [ ] **Step 3: Rewrite `producthunt/extract.ts`**

Replace the entire contents of `packages/worker/src/prompts/platform/producthunt/extract.ts` with:

```typescript
import { stageAExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";
import { buildSignalSystemPrompt } from "../_shared/signal-extraction-rules";

const SYSTEM = buildSignalSystemPrompt("Product Hunt launch posts and community comments");

export interface ProductHuntExtractInput {
  ctx: PipelineCtx;
  reviews: Array<{ id: string; rating: number; body: string }>;
}

export function buildProductHuntExtract(input: ProductHuntExtractInput): {
  system: string;
  user: string;
  schema: typeof stageAExtractSchema;
} {
  const reviewBlock = input.reviews
    .map((r) => `- id=${r.id} | votes=${r.rating} | ${oneLine(r.body)}`)
    .join("\n");
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

Product Hunt posts and comments (id-labelled):
${reviewBlock}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: stageAExtractSchema };
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 1200);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/worker && bun test src/prompts/platform/producthunt/extract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/prompts/platform/producthunt/extract.ts packages/worker/src/prompts/platform/producthunt/extract.test.ts
git commit -m "feat(worker): producthunt Stage A emits signal-centric extract"
```

---

## Task 10: Rewrite `website/extract.ts` (bespoke prompt)

The website source is the competitor's own marketing copy, not user feedback, so it does **not** use the shared user-feedback prompt. It emits the same `stageAExtractSchema` but with website-specific instructions: love = brand promises, pain = problems the site claims to solve, gap = conspicuously absent capabilities, feature = capabilities shown, pricing = pricing-page copy, switch = explicit "vs" / comparison pages.

**Files:**
- Modify: `packages/worker/src/prompts/platform/website/extract.ts`
- Create: `packages/worker/src/prompts/platform/website/extract.test.ts`

Depends on Task 1 only (does not use Task 3).

- [ ] **Step 1: Write the failing test**

Create `packages/worker/src/prompts/platform/website/extract.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { buildWebsiteExtract } from "./extract";
import { stageAExtractSchema } from "../../shared";

const ctx = {
  reportId: "r1",
  competitor: "Twilio",
  category: "Messaging",
  audience: null,
  goal: "improve_positioning",
};

describe("buildWebsiteExtract", () => {
  it("returns the Stage A signal schema", () => {
    expect(buildWebsiteExtract({ ctx, pages: [] }).schema).toBe(stageAExtractSchema);
  });

  it("system prompt lists the signal groups and is website-specific", () => {
    const sys = buildWebsiteExtract({ ctx, pages: [] }).system;
    expect(sys).toContain("love_signals");
    expect(sys).toContain("feature_signals");
    expect(sys).toContain("marketing website");
  });

  it("user message id-labels pages with url", () => {
    const built = buildWebsiteExtract({ ctx, pages: [{ id: "w1", url: "https://x.com/pricing", body: "Plans" }] });
    expect(built.user).toContain("id=w1");
    expect(built.user).toContain("https://x.com/pricing");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/worker && bun test src/prompts/platform/website/extract.test.ts`
Expected: FAIL — schema mismatch.

- [ ] **Step 3: Rewrite `website/extract.ts`**

Replace the entire contents of `packages/worker/src/prompts/platform/website/extract.ts` with:

```typescript
import { stageAExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";

const SYSTEM = `You are a competitive-intelligence analyst reading a competitor's marketing website.
You will receive a list of pages from the competitor's own marketing website, each labelled with a stable id.
This source is the competitor's own copy — not user feedback. Infer perception signals from what the site claims, shows, and omits.

Return ONE JSON object matching this exact shape (all keys required, never rename or omit):
{
  "love_signals":    [{ "title": "3-6 word label", "summary": "1-2 sentences", "sentiment": 0.8, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [{ "author": "page type", "text": "verbatim", "evidence_id": "id1" }], "related_features": ["feature name"], "user_segment": null }],
  "pain_signals":    [{ "title": "...", "summary": "...", "sentiment": -0.5, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [], "related_features": [], "user_segment": null }],
  "gap_signals":     [{ "title": "...", "summary": "...", "sentiment": -0.3, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [], "related_features": [], "user_segment": null }],
  "switch_signals":  [{ "title": "...", "summary": "...", "sentiment": 0.0, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [], "related_features": [], "user_segment": null, "direction": "inbound|outbound", "alternatives_mentioned": ["competitor name"] }],
  "pricing_signals": [{ "title": "...", "summary": "...", "sentiment": 0.0, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [], "related_features": [], "user_segment": null, "tier_label": null, "quoted_price": null }],
  "feature_signals": [{ "title": "...", "summary": "...", "sentiment": 0.0, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [], "related_features": [], "user_segment": null, "feature_name": "string", "perception": "loved|mixed|criticized" }],
  "positioning_signals": [{ "title": "...", "summary": "...", "sentiment": 0.0, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [], "related_features": [], "user_segment": null, "angle": "the positioning claim the site makes", "against": null, "audience": null }],
  "voice_phrases":   { "positive": ["phrase"], "negative": ["phrase"] },
  "evidence_quotes": [{ "author": "page type", "text": "verbatim under 200 chars", "evidence_id": "id1", "signal_type": "love|pain|gap|switch|pricing|feature|positioning", "sentiment": null }]
}

Rules:
- love_signals: the competitor's strongest brand promises and differentiators — what they want users to love.
- pain_signals: problems the site explicitly claims to solve for prospects (these reveal the pain the competitor targets).
- gap_signals: capabilities conspicuously absent vs. typical market offerings, or "coming soon" language.
- feature_signals: named product capabilities the site advertises. perception defaults to "loved" (it is their own copy).
- positioning_signals: the positioning claims and category framing the site uses. angle = the claim; against = the competitor or status quo it positions against; audience = who the copy targets.
- pricing_signals: pricing-page facts — free tier, per-seat vs flat, enterprise-only, trial length. Put verbatim prices in quoted_price.
- switch_signals: only if a "vs" page, comparison table, or migration guide explicitly names a competitor. direction = "inbound".
- evidence_quotes[].author and representative_quotes[].author: the page type (e.g. "pricing page", "homepage", "customers page").
- sentiment: -1 to 1. strength_or_severity: 0 to 1.
- evidence_ids: use ONLY the id labels provided; never invent ids.
- If a section has no signal, return an empty array — never omit the key. Never invent data.
- Return ONLY the JSON object. No prose, no markdown fences.`;

export interface WebsiteExtractInput {
  ctx: PipelineCtx;
  pages: Array<{ id: string; url: string; body: string }>;
}

export function buildWebsiteExtract(input: WebsiteExtractInput): {
  system: string;
  user: string;
  schema: typeof stageAExtractSchema;
} {
  const pageBlock = input.pages
    .map((p) => `--- id=${p.id} | url=${p.url}\n${oneLine(p.body)}`)
    .join("\n\n");

  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

Website pages (id-labelled):
${pageBlock}

Return the JSON object now.`;

  return { system: SYSTEM, user, schema: stageAExtractSchema };
}

function oneLine(s: string): string {
  return s.replace(/\n{3,}/g, "\n\n").trim().slice(0, 3000);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/worker && bun test src/prompts/platform/website/extract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/prompts/platform/website/extract.ts packages/worker/src/prompts/platform/website/extract.test.ts
git commit -m "feat(worker): website Stage A emits signal-centric extract"
```

---

## Task 11: Update the Stage A runner

**Files:**
- Modify: `packages/worker/src/pipeline/stage-a-extract.ts`
- Modify: `packages/worker/src/pipeline/stage-a-extract.test.ts`

Depends on Task 1 and Tasks 4–10 (the runner imports every platform builder; their return types must already be `stageAExtractSchema`).

- [ ] **Step 1: Replace the test file**

Replace the entire contents of `packages/worker/src/pipeline/stage-a-extract.test.ts` with:

```typescript
import { describe, expect, it } from "bun:test";
import { runStageAExtract } from "./stage-a-extract";
import type { OpenRouterClient } from "@rivaleye/shared";

describe("runStageAExtract (appstore)", () => {
  it("invokes the LLM with the appstore prompt and returns the parsed Stage A extract", async () => {
    const fakeLlm = {
      complete: async () => ({
        parsed: {
          love_signals: [
            {
              title: "Clean UI",
              summary: "Users praise the interface.",
              sentiment: 0.8,
              strength_or_severity: 0.7,
              evidence_ids: ["a1"],
              representative_quotes: [],
              related_features: [],
              user_segment: null,
            },
          ],
          pain_signals: [
            {
              title: "Sync breaks",
              summary: "sync breaks daily",
              sentiment: -0.8,
              strength_or_severity: 0.8,
              evidence_ids: ["a2"],
              representative_quotes: [],
              related_features: [],
              user_segment: null,
            },
          ],
          gap_signals: [],
          switch_signals: [],
          pricing_signals: [],
          feature_signals: [],
          voice_phrases: { positive: [], negative: ["sync breaks"] },
          evidence_quotes: [],
        },
        raw: "{}",
        usage: { promptTokens: 10, completionTokens: 5 },
        model: "test",
      }),
    } as unknown as OpenRouterClient;

    const result = await runStageAExtract({
      llm: fakeLlm,
      ctx: {
        reportId: "r1",
        competitor: "Notion",
        category: "productivity",
        audience: "founders",
        goal: "find_user_pain",
      },
      platform: "appstore",
      posts: [
        {
          externalId: "appstore:1:r1",
          title: "broken",
          body: "sync breaks daily",
          score: 1,
          numComments: null,
          author: "u",
          url: "u",
          platform: "appstore",
          createdAt: new Date(),
          raw: {},
        },
      ],
    });
    expect(result.extract.love_signals.length).toBe(1);
    expect(result.extract.pain_signals.length).toBe(1);
    expect(result.usage.promptTokens).toBe(10);
  });
});
```

(The old `buildRedditExtract` describe block is intentionally removed — those assertions now live in `src/prompts/platform/reddit/extract.test.ts` from Task 4.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/worker && bun test src/pipeline/stage-a-extract.test.ts`
Expected: FAIL — `result.extract.love_signals` is not typed/returned; `runStageAExtract` still casts to `PlatformExtract`.

- [ ] **Step 3: Update `stage-a-extract.ts`**

In `packages/worker/src/pipeline/stage-a-extract.ts`, change the type import on line 3 from:

```typescript
import type { PipelineCtx, PlatformExtract } from "../prompts/shared";
```

to:

```typescript
import type { PipelineCtx, StageAExtract } from "../prompts/shared";
import { stageAExtractSchema } from "../prompts/shared";
```

Change the `StageAOutput` interface (currently lines 19-23) from `extract: PlatformExtract` to:

```typescript
export interface StageAOutput {
  extract: StageAExtract;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}
```

Change the return statement inside `runStageAExtract` (currently line 33) from `extract: res.parsed as PlatformExtract` to:

```typescript
  return { extract: res.parsed as StageAExtract, usage: res.usage, model: res.model };
```

Change the `Builder` type (currently lines 36-40) from `schema: typeof import("../prompts/shared").platformExtractSchema` to:

```typescript
type Builder = (input: StageAInput) => {
  system: string;
  user: string;
  schema: typeof stageAExtractSchema;
};
```

Leave the `pickBuilder` function body unchanged — every platform builder already returns `schema: stageAExtractSchema` after Tasks 4–10.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/worker && bun test src/pipeline/stage-a-extract.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `cd packages/worker && bunx tsc --noEmit`
Expected: errors only in `pg-runner/source-worker.ts` (it still consumes the old shape — fixed in Task 12). If errors appear in any other file, stop and investigate.

- [ ] **Step 6: Commit**

```bash
git add packages/worker/src/pipeline/stage-a-extract.ts packages/worker/src/pipeline/stage-a-extract.test.ts
git commit -m "feat(worker): Stage A runner returns signal-centric extract"
```

---

## Task 12: Wire the new shape through `source-worker.ts`

`runStageAExtractionStep` now merges the new shape across batches and returns both the new `StageAExtract` and the legacy-derived `PlatformExtract`. `runStageBSummarizationStep` keeps feeding the legacy shape to Stage B, but persists `{ ...legacyExtract, _signals: signals }` into `report_platform_briefs.extract` — legacy fields stay at the top level so Stage C's `as PlatformExtract` cast still works.

**Files:**
- Modify: `packages/worker/src/pg-runner/source-worker.ts`

Depends on Task 2 and Task 11.

- [ ] **Step 1: Update imports**

In `packages/worker/src/pg-runner/source-worker.ts`, change the type import on line 28 from:

```typescript
import type { PlatformExtract } from "../prompts/shared";
```

to:

```typescript
import type { PlatformExtract, StageAExtract } from "../prompts/shared";
import { emptyStageAExtract, mergeStageAExtracts, toLegacyExtract } from "../pipeline/signal-adapters";
```

- [ ] **Step 2: Update the Stage A / Stage B call site in `processSourceJob`**

Replace the current Step 5 + Step 6 block (currently lines 135-141):

```typescript
    // Step 5: Run Stage A extraction
    log.info({ jobId: job.id, reportId: job.report_id, platform: job.platform }, "Running Stage A extraction");
    const extract = await runStageAExtractionStep(job.report_id, job.platform, posts, reportRow);

    // Step 6: Run Stage B summarization + persist brief
    log.info({ jobId: job.id, reportId: job.report_id, platform: job.platform }, "Running Stage B summarization");
    await runStageBSummarizationStep(job.report_id, job.platform, extract, reportRow);
```

with:

```typescript
    // Step 5: Run Stage A extraction
    log.info({ jobId: job.id, reportId: job.report_id, platform: job.platform }, "Running Stage A extraction");
    const stageA = await runStageAExtractionStep(job.report_id, job.platform, posts, reportRow);

    // Step 6: Run Stage B summarization + persist brief
    log.info({ jobId: job.id, reportId: job.report_id, platform: job.platform }, "Running Stage B summarization");
    await runStageBSummarizationStep(job.report_id, job.platform, stageA.legacy, stageA.signals, reportRow);
```

- [ ] **Step 3: Rewrite `runStageAExtractionStep`**

Replace the whole `runStageAExtractionStep` function (currently lines 300-387) with:

```typescript
/**
 * Run Stage A extraction (LLM-powered signal extraction).
 *
 * Returns both the new signal-centric extract and the legacy-shaped extract
 * derived from it, so Stage B/C keep working unchanged.
 */
async function runStageAExtractionStep(
  reportId: string,
  platform: string,
  posts: NormalizedPost[],
  reportRow: { id: string; primary_competitor_name: string | null; category: string; audience?: string | null; goal: string }
): Promise<{ legacy: PlatformExtract; signals: StageAExtract }> {
  if (posts.length === 0) {
    log.warn({ reportId, platform }, "No posts found; skipping Stage A extraction");
    const empty = emptyStageAExtract();
    return { legacy: toLegacyExtract(empty), signals: empty };
  }

  const ctx = {
    reportId,
    competitor: reportRow.primary_competitor_name ?? (reportRow.category ?? ""),
    category: reportRow.category,
    audience: reportRow.audience ?? null,
    goal: reportRow.goal,
  };

  const BATCH_SIZE = 50;
  const batches: NormalizedPost[][] = [];
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    batches.push(posts.slice(i, i + BATCH_SIZE));
  }

  log.info({ reportId, platform, totalPosts: posts.length, batches: batches.length, batchSize: BATCH_SIZE }, "Stage A: processing posts in batches");

  const allExtracts: StageAExtract[] = [];
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  for (const [batchIdx, batch] of batches.entries()) {
    log.info({ reportId, platform, batchIdx: batchIdx + 1, totalBatches: batches.length, batchSize: batch.length }, "Stage A: running batch");
    let result: Awaited<ReturnType<typeof runStageAExtract>>;
    try {
      result = await runStageAExtract({
        llm: getLlm(),
        ctx,
        platform: platform as any,
        posts: batch,
      });
    } catch (err) {
      if (err instanceof LlmSchemaError) {
        log.error({ reportId, platform, batchIdx, issues: err.issues, rawJson: JSON.stringify(err.raw).slice(0, 2000) }, "Stage A: LLM batch failed schema validation");
      }
      throw err;
    }
    allExtracts.push(result.extract);
    totalPromptTokens += result.usage.promptTokens;
    totalCompletionTokens += result.usage.completionTokens;
  }

  const signals = mergeStageAExtracts(allExtracts);
  const legacy = toLegacyExtract(signals);

  log.info({
    reportId, platform,
    batches: batches.length,
    promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens,
    loveSignals: signals.love_signals.length,
    painSignals: signals.pain_signals.length,
    gapSignals: signals.gap_signals.length,
    switchSignals: signals.switch_signals.length,
    pricingSignals: signals.pricing_signals.length,
    featureSignals: signals.feature_signals.length,
    positioningSignals: signals.positioning_signals.length,
    evidenceQuotes: signals.evidence_quotes.length,
  }, "Stage A extraction completed");

  return { legacy, signals };
}
```

- [ ] **Step 4: Rewrite `runStageBSummarizationStep`**

Replace the whole `runStageBSummarizationStep` function (currently lines 397-453) with:

```typescript
/**
 * Run Stage B summarization (LLM-powered platform summary).
 *
 * Stage B consumes the legacy extract shape unchanged. The persisted
 * report_platform_briefs.extract column stores the legacy shape at its top
 * level (so Stage C's cast keeps working) plus the full signal extract
 * under the _signals key.
 */
async function runStageBSummarizationStep(
  reportId: string,
  platform: string,
  legacyExtract: PlatformExtract,
  signals: StageAExtract,
  reportRow: { id: string; primary_competitor_name: string | null; category: string; audience?: string | null; goal: string }
): Promise<void> {
  const ctx = {
    reportId,
    competitor: reportRow.primary_competitor_name ?? (reportRow.category ?? ""),
    category: reportRow.category,
    audience: reportRow.audience ?? null,
    goal: reportRow.goal,
  };

  log.info({ reportId, platform, complaints: legacyExtract.complaints.length }, "Stage B: running LLM summarization");
  const stageBResult = await runStageBSummarize({
    llm: getLlm(),
    ctx,
    platform: platform as any,
    extract: legacyExtract,
  });

  log.info({
    reportId, platform,
    promptTokens: stageBResult.usage.promptTokens,
    completionTokens: stageBResult.usage.completionTokens,
    headline: stageBResult.brief.headline,
    topThemes: stageBResult.brief.top_themes.length,
    sentiment: stageBResult.brief.sentiment,
  }, "Stage B summarization completed");

  const extractColumn = { ...legacyExtract, _signals: signals } as unknown as Record<string, unknown>;

  // Persist brief to DB so synthesis (Stage C) can load it
  log.info({ reportId, platform }, "Stage B: persisting brief to DB");
  await db
    .insert(report_platform_briefs)
    .values({
      report_id: reportId,
      platform,
      extract: extractColumn,
      summary: stageBResult.brief as unknown as Record<string, unknown>,
      model_used: stageBResult.model,
      prompt_tokens: stageBResult.usage.promptTokens,
      completion_tokens: stageBResult.usage.completionTokens,
    })
    .onConflictDoUpdate({
      target: [report_platform_briefs.report_id, report_platform_briefs.platform],
      set: {
        extract: extractColumn,
        summary: stageBResult.brief as unknown as Record<string, unknown>,
        model_used: stageBResult.model,
        prompt_tokens: stageBResult.usage.promptTokens,
        completion_tokens: stageBResult.usage.completionTokens,
      },
    });

  log.info({ reportId, platform }, "Stage B: brief persisted");
}
```

- [ ] **Step 5: Type-check the whole worker package**

Run: `cd packages/worker && bunx tsc --noEmit`
Expected: no errors anywhere in the package.

- [ ] **Step 6: Run the full worker test suite**

Run: `cd packages/worker && bun test src/`
Expected: all tests pass — the new Stage A tests plus every pre-existing pipeline test (Stage B/C/D/E, persist, derive-stats) still green, proving the legacy bridge is intact.

- [ ] **Step 7: Commit**

```bash
git add packages/worker/src/pg-runner/source-worker.ts
git commit -m "feat(worker): persist Stage A signals via legacy bridge in source-worker"
```

---

## Task 13: End-to-end verification

**Files:** none (verification only).

Depends on Task 12.

- [ ] **Step 1: Confirm the worker package is clean**

Run: `cd packages/worker && bunx tsc --noEmit && bun test src/`
Expected: type-check clean, all tests pass.

- [ ] **Step 2: Run one real report locally**

Start the stack (`pnpm dev` from the repo root) and create a report for a well-known competitor through the web app at `http://localhost:4004`. Wait for it to reach `completed`.

- [ ] **Step 3: Inspect the persisted signals**

Open Drizzle Studio (`pnpm db:studio`) and inspect a `report_platform_briefs` row for that report. Verify:
- the `extract` column has the legacy keys at the top level (`complaints`, `features_requested`, `pricing_signals`, `switching_signals`, `voice_phrases`, `notable_quotes`)
- the `extract` column has a `_signals` key containing `love_signals`, `pain_signals`, `gap_signals`, `switch_signals`, `pricing_signals`, `feature_signals`, `positioning_signals`, `evidence_quotes`
- `_signals.love_signals` is non-empty for a competitor that has fans (this is the core Phase 1 win — love is now captured)

- [ ] **Step 4: Confirm the report still renders**

Open the finished report in the web app. It must render exactly as before — Phase 1 changes nothing the frontend consumes. If the report renders and completed without error, the legacy bridge is verified.

- [ ] **Step 5: Final commit (if any verification notes/fixes were made)**

Only commit if Steps 1-4 surfaced a fix. Otherwise Phase 1 is complete.

---

## Self-Review

**Spec coverage** (against `15-signal-centric-pipeline-redesign.md` §9 Phase 1):
- "Add `stageAExtractSchema` and the `Signal` shape" → Task 1 ✓
- "Rewrite the seven platform `extract.ts` prompts" → Tasks 4–10 ✓
- "love balanced with pain" → shared prompt (Task 3) + website prompt (Task 10) ✓
- "Add `toLegacyExtract()` adapter" → Task 2 ✓
- "store both new and legacy extract JSON on `report_platform_briefs.extract`" → Task 12 ✓
- "Stage B/C/D/E untouched" → enforced by scope guard; verified by Task 12 Step 6 and Task 13 ✓
- No DB migration in Phase 1 → confirmed; no schema file is touched ✓

**Placeholder scan:** no TBD/TODO; every code step shows complete file or exact edit; every test step shows real assertions.

**Type consistency:** `StageAExtract`, `stageAExtractSchema`, `toLegacyExtract`, `mergeStageAExtracts`, `emptyStageAExtract`, `buildSignalSystemPrompt` are defined in Tasks 1–3 and referenced with identical names/signatures in Tasks 4–12. `runStageAExtractionStep` returns `{ legacy, signals }`; the call site (Task 12 Step 2) and `runStageBSummarizationStep` signature (Task 12 Step 4) consume exactly those names.

**Out-of-scope deferred to later phases:** multi-signal Stage C clustering (Phase 2), role sections (Phase 3), `report_sections` table (Phase 4), frontend dashboards (Phase 5).
