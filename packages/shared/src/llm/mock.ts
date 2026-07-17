import type { ZodSchema, ZodTypeAny } from "zod";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { LlmCallOptions, LlmClient, LlmRequest, LlmResponse } from "./types";
import { generateMock, type MockRng } from "./zod-mock";

/**
 * Deterministic, zero-cost LLM provider for the no-cost verification path.
 *
 * Selected via LLM_PROVIDER=mock. Never touches the network. For schema-bearing
 * requests it either replays a recorded fixture (LLM_FIXTURES_DIR/<tag>.json)
 * or generates a schema-valid value from the request's Zod schema, weaving real
 * sentences out of the user prompt into content fields so mock reports read like
 * real ones. Latency is simulated (MOCK_LLM_LATENCY_MS) with deterministic
 * per-call variance so load tests see realistic timing without real spend.
 */

function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): MockRng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sanitizeTag(tag: string): string {
  return tag.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 120) || "untagged";
}

const CANNED_PROSE = [
  "Based on the discussions reviewed, users consistently raise the same handful of themes.",
  "The strongest signal is around reliability and support responsiveness.",
  "Several users mention they are actively evaluating alternatives.",
];

export interface MockLlmClientOptions {
  model?: string;
  fixturesDir?: string;
  latencyMs?: number;
}

export class MockLlmClient implements LlmClient {
  private readonly model: string;
  private readonly fixturesDir: string | null;
  private readonly latencyMs: number;

  constructor(opts: MockLlmClientOptions = {}) {
    this.model = opts.model ?? "mock";
    this.fixturesDir = opts.fixturesDir ?? process.env.LLM_FIXTURES_DIR ?? null;
    const rawLatency = opts.latencyMs ?? Number(process.env.MOCK_LLM_LATENCY_MS ?? 200);
    this.latencyMs = Number.isFinite(rawLatency) && rawLatency >= 0 ? rawLatency : 200;
  }

  async complete<T>(req: LlmRequest<ZodSchema<T>>, opts?: LlmCallOptions): Promise<LlmResponse<T>>;
  async complete(req: LlmRequest, opts?: LlmCallOptions): Promise<LlmResponse<string>>;
  async complete<T>(
    req: LlmRequest<ZodSchema<T> | undefined>,
    _opts?: LlmCallOptions,
  ): Promise<LlmResponse<T | string>> {
    const seed = hash32(`${req.tag ?? ""}::${req.system.slice(0, 200)}::${req.user.slice(0, 500)}`);
    const rng = mulberry32(seed);

    await this.simulateLatency(rng);

    if (!req.schema) {
      const content = CANNED_PROSE[Math.floor(rng() * CANNED_PROSE.length)] as string;
      return {
        parsed: content,
        raw: content,
        usage: this.usage(req, content),
        model: this.model,
      };
    }

    const fixture = this.loadFixture(req.tag, req.schema);
    const parsed = fixture ?? (generateMock(req.schema as ZodTypeAny, rng, { userPrompt: req.user }) as T);
    const raw = JSON.stringify(parsed);
    return { parsed, raw, usage: this.usage(req, raw), model: this.model };
  }

  private loadFixture<T>(tag: string | undefined, schema: ZodSchema<T>): T | null {
    if (!this.fixturesDir || !tag) return null;
    const path = join(this.fixturesDir, `${sanitizeTag(tag)}.json`);
    if (!existsSync(path)) return null;
    try {
      const data = JSON.parse(readFileSync(path, "utf8"));
      const result = schema.safeParse(data);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }

  private usage(
    req: { system: string; user: string },
    response: string,
  ): { promptTokens: number; completionTokens: number } {
    return {
      promptTokens: Math.ceil((req.system.length + req.user.length) / 4),
      completionTokens: Math.ceil(response.length / 4),
    };
  }

  private simulateLatency(rng: MockRng): Promise<void> {
    if (this.latencyMs <= 0) return Promise.resolve();
    const ms = this.latencyMs * (0.5 + rng());
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
