import type { LlmCallOptions, LlmClient } from "@rivaleye/shared";
import { synthOutputSchema, type MergedClusters, type PipelineCtx, type PlatformBrief, type PlatformExtract, type SynthOutput } from "../prompts/shared";
import { buildSynth } from "../prompts/cross/synth";
import { PipelineError } from "./errors";

export interface StageDInput {
  llm: LlmClient;
  ctx: PipelineCtx;
  merged: MergedClusters;
  briefs: PlatformBrief[];
  extracts: PlatformExtract[];
}

export interface StageDOutput {
  synth: SynthOutput;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

const MAX_TOKENS = 16000;

export function enrichSynthOutput(
  synth: SynthOutput,
  merged: MergedClusters,
  briefs: PlatformBrief[],
  extracts: PlatformExtract[],
): SynthOutput {
  const mentionsByTitle = new Map<string, number>(
    merged.complaint_clusters.map((c) => [c.title.trim().toLowerCase(), c.evidence_ids.length]),
  );

  const complaints = synth.complaints.map((complaint) => ({
    ...complaint,
    mentions: mentionsByTitle.get(complaint.title.trim().toLowerCase()) ?? complaint.mentions,
  }));

  const allQuotes = extracts.flatMap((e) => e.notable_quotes);
  const quotes =
    allQuotes.length > 0
      ? allQuotes.map((q) => ({
          who: q.author,
          sub: null as string | null,
          when_label: null as string | null,
          score: 0,
          sentiment: null as number | null,
          text: q.text,
        }))
      : synth.quotes;

  let reportMeta = synth.report_meta;
  if (briefs.length > 0) {
    const avgPos = briefs.reduce((sum, b) => sum + b.sentiment.positive, 0) / briefs.length;
    const avgNeu = briefs.reduce((sum, b) => sum + b.sentiment.neutral, 0) / briefs.length;
    const avgNeg = briefs.reduce((sum, b) => sum + b.sentiment.negative, 0) / briefs.length;
    const sentOverall = Math.round((avgPos - avgNeg) * 100) / 100;
    reportMeta = {
      ...reportMeta,
      sentiment_overall: sentOverall,
      sentiment_positive: Math.round(avgPos * 100) / 100,
      sentiment_neutral: Math.round(avgNeu * 100) / 100,
      sentiment_negative: Math.round(avgNeg * 100) / 100,
    };
  }

  return { ...synth, complaints, quotes, report_meta: reportMeta };
}

export async function runStageDSynth(input: StageDInput, opts?: LlmCallOptions): Promise<StageDOutput> {
  const built = buildSynth({ ctx: input.ctx, merged: input.merged, extracts: input.extracts });
  try {
    const res = await input.llm.complete({
      system: built.system,
      user: built.user,
      schema: built.schema,
      maxTokens: MAX_TOKENS,
    }, opts);
    const synth = enrichSynthOutput(
      synthOutputSchema.parse(res.parsed),
      input.merged,
      input.briefs,
      input.extracts,
    );
    return { synth, usage: res.usage, model: res.model };
  } catch (err) {
    throw new PipelineError("D", "synth failed", err);
  }
}
