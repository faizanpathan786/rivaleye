import type { PlatformId } from "@rivaleye/scrapers";
import type { LlmCallOptions, LlmClient } from "@rivaleye/shared";
import type {
  EvidenceIndexItem, MergedClusters, MergedSignals, PipelineCtx, PlatformBrief, StageAExtract,
  StageCMergeLlmOutput,
} from "../prompts/shared";
import { buildSignalMerge } from "../prompts/cross/merge-signals";
import { enrichMergedSignals, toLegacyMergedClusters } from "./signal-cluster-adapters";
import { PipelineError } from "./errors";

export interface StageCInput {
  llm: LlmClient;
  ctx: PipelineCtx;
  briefs: PlatformBrief[];
  signalExtracts: Array<{ platform: PlatformId; extract: StageAExtract }>;
}

export interface StageCOutput {
  merged: MergedClusters;
  mergedSignals: MergedSignals;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

/** Build evidence_id -> platform from the per-platform signal extracts. */
function buildEvidencePlatformMap(
  signalExtracts: StageCInput["signalExtracts"],
): Map<string, PlatformId> {
  const map = new Map<string, PlatformId>();
  for (const { platform, extract } of signalExtracts) {
    const groups = [
      extract.love_signals, extract.pain_signals, extract.gap_signals,
      extract.switch_signals, extract.pricing_signals, extract.feature_signals,
      extract.positioning_signals,
    ];
    for (const group of groups) {
      for (const signal of group) {
        for (const id of signal.evidence_ids) map.set(id, platform);
      }
    }
    for (const q of extract.evidence_quotes) map.set(q.evidence_id, platform);
  }
  return map;
}

/** Build the evidence index from every platform's evidence_quotes. */
function buildEvidenceIndex(
  signalExtracts: StageCInput["signalExtracts"],
): EvidenceIndexItem[] {
  const byId = new Map<string, EvidenceIndexItem>();
  for (const { platform, extract } of signalExtracts) {
    for (const q of extract.evidence_quotes) {
      if (byId.has(q.evidence_id)) continue;
      byId.set(q.evidence_id, {
        evidence_id: q.evidence_id,
        source: platform as EvidenceIndexItem["source"],
        text: q.text,
        author: q.author || null,
        source_url: null,
        source_date: null,
        related_signal_ids: [],
        related_cluster_ids: [],
        sentiment: q.sentiment,
        confidence: 0,
      });
    }
  }
  return [...byId.values()];
}

function countSignals(extract: StageAExtract): number {
  return (
    extract.love_signals.length + extract.pain_signals.length + extract.gap_signals.length +
    extract.switch_signals.length + extract.pricing_signals.length +
    extract.feature_signals.length + extract.positioning_signals.length
  );
}

export async function runStageCMerge(input: StageCInput, opts?: LlmCallOptions): Promise<StageCOutput> {
  const built = buildSignalMerge({
    ctx: input.ctx,
    briefs: input.briefs,
    signalExtracts: input.signalExtracts,
  });
  try {
    const res = await input.llm.complete(
      { system: built.system, user: built.user, schema: built.schema },
      opts,
    );
    const llmOutput = res.parsed as StageCMergeLlmOutput;
    const mergedSignals = enrichMergedSignals(llmOutput, {
      evidencePlatform: buildEvidencePlatformMap(input.signalExtracts),
      evidenceIndex: buildEvidenceIndex(input.signalExtracts),
      totalInputSignals: input.signalExtracts.reduce((s, x) => s + countSignals(x.extract), 0),
      model: res.model,
    });
    return {
      merged: toLegacyMergedClusters(mergedSignals),
      mergedSignals,
      usage: res.usage,
      model: res.model,
    };
  } catch (err) {
    throw new PipelineError("C", "merge failed", err);
  }
}
