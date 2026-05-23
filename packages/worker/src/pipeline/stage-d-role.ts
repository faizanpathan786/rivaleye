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

    const roleSections: RoleSections = {
      overview: overviewSectionSchema.parse(overviewRes.parsed),
      founder: founderViewSectionSchema.parse(founderRes.parsed),
      product: productViewSectionSchema.parse(productRes.parsed),
      marketing: marketingViewSectionSchema.parse(marketingRes.parsed),
      growth: growthViewSectionSchema.parse(growthRes.parsed),
      evidence,
    };

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
