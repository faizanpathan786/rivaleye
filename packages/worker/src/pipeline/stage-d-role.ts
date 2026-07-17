import type { LlmCallOptions, LlmClient } from "@rivaleye/shared";
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
// Number of LLM call attempts per section before we give up on that one
// dashboard. A failure here is isolated — never blocks other sections.
const MAX_SECTION_ATTEMPTS = 3;

function parseRaw(raw: string): unknown {
  try {
    const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

interface BuiltPrompt {
  system: string;
  user: string;
}

interface SectionResult<T> {
  data: T | undefined;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

interface SectionSchema<T> {
  safeParse: (
    data: unknown,
  ) =>
    | { success: true; data: T }
    | { success: false; error: { message: string; issues?: unknown } };
}

/**
 * Run one role-section's LLM call with isolated retry — up to
 * MAX_SECTION_ATTEMPTS calls, returning the first that parses against the
 * schema. Retries get a corrective hint so the model re-derives clean JSON
 * (the typical failure is a truncated or wrapped response).
 */
async function ensureSection<T>(
  llm: LlmClient,
  built: BuiltPrompt,
  schema: SectionSchema<T>,
  name: string,
  opts?: LlmCallOptions,
): Promise<SectionResult<T>> {
  const usage = { promptTokens: 0, completionTokens: 0 };
  let model = "";
  for (let attempt = 1; attempt <= MAX_SECTION_ATTEMPTS; attempt++) {
    const user =
      attempt === 1
        ? built.user
        : `${built.user}\n\nIMPORTANT (retry ${attempt}/${MAX_SECTION_ATTEMPTS}): your previous response did not parse as the expected JSON. Return ONLY a single complete JSON object matching the schema for this section — no prose, no markdown fences, no truncation, no extra keys. Re-derive the JSON from the signals cleanly.`;
    try {
      const res = await llm.complete(
        { system: built.system, user, maxTokens: MAX_TOKENS },
        opts,
      );
      usage.promptTokens += res.usage.promptTokens;
      usage.completionTokens += res.usage.completionTokens;
      model = res.model;
      const parsed = parseRaw(res.raw);
      const result = schema.safeParse(parsed);
      if (result.success) {
        if (attempt > 1) {
          log.info({ name, attempt }, `${name} section recovered on retry`);
        }
        return { data: result.data, usage, model };
      }
      log.warn(
        {
          name,
          attempt,
          error: result.error.message,
          issues: result.error.issues,
          rawHead: res.raw.slice(0, 280),
          rawLength: res.raw.length,
        },
        `${name} section parse failed`,
      );
    } catch (err) {
      log.warn(
        { name, attempt, err: err instanceof Error ? err.message : String(err) },
        `${name} section call threw`,
      );
    }
  }
  log.warn({ name, attempts: MAX_SECTION_ATTEMPTS }, `${name} section gave up after retries`);
  return { data: undefined, usage, model };
}

export interface RoleSynthesisInput {
  llm: LlmClient;
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

    // Each section runs its own isolated retry chain in parallel — a failure
    // in one (e.g. product returning malformed JSON) never kills the rest.
    const [overview, founder, product, marketing, growth] = await Promise.all([
      ensureSection(llm, overviewBuilt, overviewSectionSchema, "overview", opts),
      ensureSection(llm, founderBuilt, founderViewSectionSchema, "founder", opts),
      ensureSection(llm, productBuilt, productViewSectionSchema, "product", opts),
      ensureSection(llm, marketingBuilt, marketingViewSectionSchema, "marketing", opts),
      ensureSection(llm, growthBuilt, growthViewSectionSchema, "growth", opts),
    ]);

    const evidence = buildEvidenceSection(mergedSignals);

    // Overview is the minimum viable section — abort if even retries couldn't
    // produce it. Anything else can be missing; persistReport skips undefined.
    if (overview.data === undefined) {
      throw new Error(
        `overview section failed after ${MAX_SECTION_ATTEMPTS} attempts — cannot build role sections without it`,
      );
    }

    const roleSections = {
      overview: overview.data,
      founder: founder.data,
      product: product.data,
      marketing: marketing.data,
      growth: growth.data,
      evidence,
    } as unknown as RoleSections;

    const usage = {
      promptTokens:
        overview.usage.promptTokens +
        founder.usage.promptTokens +
        product.usage.promptTokens +
        marketing.usage.promptTokens +
        growth.usage.promptTokens,
      completionTokens:
        overview.usage.completionTokens +
        founder.usage.completionTokens +
        product.usage.completionTokens +
        marketing.usage.completionTokens +
        growth.usage.completionTokens,
    };

    return { roleSections, usage, model: overview.model };
  } catch (err) {
    if (err instanceof PipelineError) throw err;
    throw new PipelineError("D", "role synthesis failed", err);
  }
}
