import { describe, expect, it } from "bun:test";
import type { ZodTypeAny } from "zod";
import { generateMock, type MockRng } from "./zod-mock";
import { discoveredIdsSchema } from "./discover";

// The mock LLM provider must produce schema-VALID output for every schema the
// real pipeline sends to llm.complete({ schema }). We import the actual pipeline
// schemas (not copies) so this test breaks if a prompt schema evolves past what
// the zod-walker supports. The worker package is a workspace sibling; importing
// its prompt modules here keeps the walker honest against production shapes.
import * as promptShared from "../../../worker/src/prompts/shared";
import { summaryDataSchema } from "../../../worker/src/prompts/summary-synthesis";
import {
  overviewSectionSchema,
  founderViewSectionSchema,
  productViewSectionSchema,
  marketingViewSectionSchema,
  growthViewSectionSchema,
  roleSectionsSchema,
} from "../../../worker/src/prompts/role-sections/schema";

function isZodSchema(v: unknown): v is ZodTypeAny {
  return (
    typeof v === "object" &&
    v !== null &&
    "_def" in v &&
    typeof (v as { _def?: { typeName?: unknown } })._def?.typeName === "string" &&
    typeof (v as { safeParse?: unknown }).safeParse === "function"
  );
}

function seededRng(seed: number): MockRng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CONTEXT = {
  userPrompt:
    "Users complain the sync breaks on large workspaces. The reporting dashboard is loved. " +
    "Support is slow to respond. Several people are switching to a competitor over pricing. " +
    "There is a strong request for an offline mode and a public API.",
};

// The primary output schemas the pipeline actually sends to the LLM.
const CRITICAL_SCHEMAS: Record<string, ZodTypeAny> = {
  stageAExtractSchema: promptShared.stageAExtractSchema,
  platformBriefSchema: promptShared.platformBriefSchema,
  stageCMergeLlmSchema: promptShared.stageCMergeLlmSchema,
  mergedClustersSchema: promptShared.mergedClustersSchema,
  synthOutputSchema: promptShared.synthOutputSchema,
  summaryDataSchema,
  overviewSectionSchema,
  founderViewSectionSchema,
  productViewSectionSchema,
  marketingViewSectionSchema,
  growthViewSectionSchema,
  roleSectionsSchema,
  discoveredIdsSchema,
};

describe("generateMock covers critical pipeline schemas", () => {
  for (const [name, schema] of Object.entries(CRITICAL_SCHEMAS)) {
    it(`produces valid output for ${name} (10 seeds)`, () => {
      for (let seed = 1; seed <= 10; seed++) {
        const value = generateMock(schema, seededRng(seed), CONTEXT);
        const result = schema.safeParse(value);
        if (!result.success) {
          throw new Error(
            `${name} seed=${seed} failed: ${JSON.stringify(result.error.issues.slice(0, 5), null, 2)}`,
          );
        }
        expect(result.success).toBe(true);
      }
    });
  }
});

describe("generateMock covers every exported schema in prompts/shared", () => {
  const entries = Object.entries(promptShared).filter(([, v]) => isZodSchema(v)) as Array<
    [string, ZodTypeAny]
  >;
  it("finds a meaningful number of schemas", () => {
    expect(entries.length).toBeGreaterThan(10);
  });
  for (const [name, schema] of entries) {
    it(`produces valid output for prompts/shared:${name}`, () => {
      const value = generateMock(schema, seededRng(42), CONTEXT);
      const result = schema.safeParse(value);
      if (!result.success) {
        throw new Error(
          `${name} failed: ${JSON.stringify(result.error.issues.slice(0, 5), null, 2)}`,
        );
      }
      expect(result.success).toBe(true);
    });
  }
});
