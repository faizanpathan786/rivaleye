import OpenAI from "openai";
import { z } from "zod";
import { buildStage1Prompt } from "../prompts";

// ---- OpenRouter client (same pattern as llm.ts) ----

const apiKey = process.env["OPENROUTER_API_KEY"];
if (!apiKey) throw new Error("OPENROUTER_API_KEY is required");

const openRouter = new OpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
});

// ---- Types ----

/** Maps synthetic IDs (p001..p150) back to original externalId values. */
export type SyntheticIdMap = Map<string, string>;

export type PipelineCtx = {
  reportId: string;
  competitor: string;
  category: string;
  founderGoal: string;
  stage1Model?: string;
  stage2Model?: string;
  stage3Model?: string;
  stage4Model?: string;
};

// ---- Zod schemas ----

const rawClusterSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  evidence_post_ids: z.array(z.string()).min(2),
  voice_phrases: z.array(z.string()),
});

const voicePhraseEntrySchema = z.union([
  z.string(),
  z.object({ phrase: z.string(), count: z.number().int().optional() }),
]);

const stage1OutputSchema = z.object({
  clusters: z.array(rawClusterSchema),
  voice_phrases: z.array(voicePhraseEntrySchema).optional(),
});

export type RawCluster = z.infer<typeof rawClusterSchema>;

export type Stage1Output = {
  rawClusters: RawCluster[];
  voicePhrases: string[];
  syntheticIdMap: SyntheticIdMap;
};

// ---- Helpers ----

const MAX_POSTS = 150;
const MAX_BODY_CHARS = 800;
const DEFAULT_MODEL = "deepseek/deepseek-v3-0324:free";

/**
 * Format a zero-padded synthetic post ID: 1 → "p001", 150 → "p150".
 */
function toSyntheticId(index: number): string {
  return `p${String(index).padStart(3, "0")}`;
}

/**
 * Strip markdown code fences from an LLM response.
 * Handles: ```json ... ```, ``` ... ```, and bare JSON.
 */
function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim();
}

/**
 * Normalise voice_phrases entries — either top-level or from cluster arrays —
 * to plain strings.
 */
function extractVoicePhrases(
  parsed: z.infer<typeof stage1OutputSchema>,
): string[] {
  const phrases: string[] = [];

  // Cluster-level voice_phrases (primary source per spec)
  for (const cluster of parsed.clusters) {
    phrases.push(...cluster.voice_phrases);
  }

  // Optional top-level voice_phrases field
  if (parsed.voice_phrases) {
    for (const entry of parsed.voice_phrases) {
      if (typeof entry === "string") {
        phrases.push(entry);
      } else {
        phrases.push(entry.phrase);
      }
    }
  }

  // Deduplicate while preserving order
  return [...new Set(phrases)];
}

async function callStage1Llm(
  system: string,
  user: string,
  model: string,
): Promise<string> {
  const response = await openRouter.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("[stage1] empty LLM response");
  return content;
}

// ---- Main export ----

export async function runStage1(
  ctx: PipelineCtx,
  posts: Array<{
    externalId: string;
    title: string;
    body: string;
    score: number;
    createdAt: Date | string | number;
  }>,
): Promise<Stage1Output> {
  const model =
    ctx.stage1Model ??
    process.env["STAGE1_MODEL"] ??
    DEFAULT_MODEL;

  // 1. Slice to first 150 posts and build synthetic ID map
  const sliced = posts.slice(0, MAX_POSTS);
  const syntheticIdMap: SyntheticIdMap = new Map();

  for (let i = 0; i < sliced.length; i++) {
    const synId = toSyntheticId(i + 1);
    const post = sliced[i];
    if (post !== undefined) {
      syntheticIdMap.set(synId, post.externalId);
    }
  }

  // 2. Map to Stage1Input format
  const stage1Posts = sliced.map((post, i) => {
    const synId = toSyntheticId(i + 1);

    let createdUtc: number;
    if (post.createdAt instanceof Date) {
      createdUtc = Math.floor(post.createdAt.getTime() / 1000);
    } else if (typeof post.createdAt === "number") {
      // Accept both seconds and milliseconds
      createdUtc =
        post.createdAt > 1e10
          ? Math.floor(post.createdAt / 1000)
          : post.createdAt;
    } else {
      createdUtc = Math.floor(new Date(post.createdAt).getTime() / 1000);
    }

    return {
      id: synId,
      body: post.body.slice(0, MAX_BODY_CHARS),
      title: post.title,
      score: post.score,
      created_utc: createdUtc,
    };
  });

  // 3. Build prompt
  const { system, user } = buildStage1Prompt({
    posts: stage1Posts,
    competitor: ctx.competitor,
    category: ctx.category,
  });

  // 4 + 5 + 6 + 7. LLM call → strip fences → parse → validate (with one retry)
  const raw = await callStage1Llm(system, user, model);
  const parsed = parseAndValidate(raw);

  if (parsed.success) {
    return buildOutput(parsed.data, syntheticIdMap);
  }

  // 8. Retry once with validation error prepended
  const retryUser =
    `Previous response failed validation: ${parsed.error.message}. Try again. Output valid JSON only.\n\n` +
    user;

  const retryRaw = await callStage1Llm(system, retryUser, model);
  const retryParsed = parseAndValidate(retryRaw);

  if (retryParsed.success) {
    return buildOutput(retryParsed.data, syntheticIdMap);
  }

  // 9. Both attempts failed — throw
  throw new Error(
    `Stage1ValidationError: ${retryParsed.error.message}`,
  );
}

// ---- Private helpers ----

type ParseResult =
  | { success: true; data: z.infer<typeof stage1OutputSchema> }
  | { success: false; error: { message: string } };

function parseAndValidate(raw: string): ParseResult {
  const stripped = stripFences(raw);
  let json: unknown;
  try {
    json = JSON.parse(stripped);
  } catch (err) {
    // Treat JSON parse failures uniformly with schema validation failures.
    return {
      success: false,
      error: {
        message: `JSON.parse failed: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }
  const result = stage1OutputSchema.safeParse(json);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: { message: String(result.error) },
  };
}

function buildOutput(
  data: z.infer<typeof stage1OutputSchema>,
  syntheticIdMap: SyntheticIdMap,
): Stage1Output {
  // 10. Filter clusters with <2 evidence_post_ids
  const rawClusters = data.clusters.filter(
    (c: RawCluster) => c.evidence_post_ids.length >= 2,
  );

  // 11. Extract voice phrases
  const voicePhrases = extractVoicePhrases({ ...data, clusters: rawClusters });

  return {
    rawClusters,
    voicePhrases,
    syntheticIdMap,
  };
}
