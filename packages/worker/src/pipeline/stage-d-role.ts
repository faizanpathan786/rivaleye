import type { LlmCallOptions, OpenRouterClient } from "@rivaleye/shared";
import type { PipelineCtx, MergedSignals } from "../prompts/shared";
import { buildOverviewSynth } from "../prompts/role-sections/overview";
import { buildFounderSynth } from "../prompts/role-sections/founder";
import { buildProductSynth } from "../prompts/role-sections/product";
import { buildMarketingSynth } from "../prompts/role-sections/marketing";
import { buildGrowthSynth } from "../prompts/role-sections/growth";
import { buildEvidenceSection } from "./build-evidence-section";
import type { RoleSections } from "../prompts/role-sections/schema";
import {
  overviewSectionSchema,
  founderViewSectionSchema,
  productViewSectionSchema,
  marketingViewSectionSchema,
  growthViewSectionSchema,
} from "../prompts/role-sections/schema";
import { PipelineError } from "./errors";
import pino from "pino";

const log = pino({ name: "stage-d-role" });

const MAX_TOKENS = 16000;

export interface RoleSynthesisInput {
  llm: OpenRouterClient;
  ctx: PipelineCtx;
  mergedSignals: MergedSignals;
}

export interface RoleSynthesisOutput {
  roleSections: RoleSections;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

function safeSection<T>(
  schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: { message: string } } },
  parsed: unknown,
  name: string,
): T | undefined {
  const result = schema.safeParse(parsed);
  if (!result.success) {
    log.warn({ error: result.error.message }, `${name} section parse failed`);
    return undefined;
  }
  return result.data;
}

export async function runRoleSynthesis(
  input: RoleSynthesisInput,
  opts?: LlmCallOptions,
): Promise<RoleSynthesisOutput> {
  const { llm, ctx, mergedSignals } = input;

  try {
    const overviewBuilt = buildOverviewSynth({ ctx, mergedSignals });
    const founderBuilt = buildFounderSynth({ ctx, mergedSignals });
    const productBuilt = buildProductSynth({ ctx, mergedSignals });
    const marketingBuilt = buildMarketingSynth({ ctx, mergedSignals });
    const growthBuilt = buildGrowthSynth({ ctx, mergedSignals });

    const [overviewRes, founderRes, productRes, marketingRes, growthRes] = await Promise.all([
      llm.complete({ system: overviewBuilt.system, user: overviewBuilt.user, schema: overviewBuilt.schema, maxTokens: MAX_TOKENS }, opts),
      llm.complete({ system: founderBuilt.system, user: founderBuilt.user, schema: founderBuilt.schema, maxTokens: MAX_TOKENS }, opts),
      llm.complete({ system: productBuilt.system, user: productBuilt.user, schema: productBuilt.schema, maxTokens: MAX_TOKENS }, opts),
      llm.complete({ system: marketingBuilt.system, user: marketingBuilt.user, schema: marketingBuilt.schema, maxTokens: MAX_TOKENS }, opts),
      llm.complete({ system: growthBuilt.system, user: growthBuilt.user, schema: growthBuilt.schema, maxTokens: MAX_TOKENS }, opts),
    ]);

    const evidence = buildEvidenceSection(mergedSignals);

    // Parse each section individually — one bad LLM response must not kill all sections.
    const overview = safeSection(overviewSectionSchema, overviewRes.parsed, "overview");
    const founder = safeSection(founderViewSectionSchema, founderRes.parsed, "founder");
    const product = safeSection(productViewSectionSchema, productRes.parsed, "product");
    const marketing = safeSection(marketingViewSectionSchema, marketingRes.parsed, "marketing");
    const growth = safeSection(growthViewSectionSchema, growthRes.parsed, "growth");

    // Overview is the minimum viable section — abort if it failed.
    if (overview === undefined) {
      throw new Error("overview section parse failed — cannot build role sections without it");
    }

    // Build the assembled sections object. Sections that failed will be
    // skipped by persistReport (it does `if (data === undefined) continue`).
    const roleSections = {
      overview,
      founder,
      product,
      marketing,
      growth,
      evidence,
    } as unknown as RoleSections;

    const usage = {
      promptTokens:
        overviewRes.usage.promptTokens +
        founderRes.usage.promptTokens +
        productRes.usage.promptTokens +
        marketingRes.usage.promptTokens +
        growthRes.usage.promptTokens,
      completionTokens:
        overviewRes.usage.completionTokens +
        founderRes.usage.completionTokens +
        productRes.usage.completionTokens +
        marketingRes.usage.completionTokens +
        growthRes.usage.completionTokens,
    };

    return { roleSections, usage, model: overviewRes.model };
  } catch (err) {
    if (err instanceof PipelineError) throw err;
    throw new PipelineError("D", "role synthesis failed", err);
  }
}
