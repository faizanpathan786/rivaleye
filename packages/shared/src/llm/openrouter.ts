import type { ZodSchema } from "zod";
import { LlmHttpError, LlmJsonParseError, LlmSchemaError } from "./errors";

export interface LlmRequest<TSchema extends ZodSchema | undefined = undefined> {
  system: string;
  user: string;
  schema?: TSchema;
  maxTokens?: number;
}

export interface LlmResponse<T> {
  parsed: T;
  raw: string;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

export interface OpenRouterClientOptions {
  apiKey: string;
  model: string;
  temperature?: number;
  fetcher?: typeof fetch;
  baseUrl?: string;
}

interface OpenRouterChoice {
  message?: { content?: string };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const DEFAULT_BASE = "https://openrouter.ai/api/v1";
const RETRY_SUFFIX =
  "\n\nReturn ONLY a single valid JSON object that matches the schema. No prose, no markdown fence.";

export class OpenRouterClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly temperature: number;
  private readonly fetcher: typeof fetch;
  private readonly baseUrl: string;

  constructor(opts: OpenRouterClientOptions) {
    if (!opts.apiKey) throw new Error("OpenRouterClient: apiKey required");
    if (!opts.model) throw new Error("OpenRouterClient: model required");
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.temperature = opts.temperature ?? 1.0;
    this.fetcher = opts.fetcher ?? fetch;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE;
  }

  async complete<T>(req: LlmRequest<ZodSchema<T>>): Promise<LlmResponse<T>>;
  async complete(req: LlmRequest): Promise<LlmResponse<string>>;
  async complete<T>(req: LlmRequest<ZodSchema<T> | undefined>): Promise<LlmResponse<T | string>> {
    const raw = await this.callWithRetry(req.system, req.user, req.maxTokens);
    if (!req.schema) {
      return { parsed: raw.content, raw: raw.content, usage: raw.usage, model: this.model };
    }
    const json = this.parseJson(raw.content);
    const result = req.schema.safeParse(json);
    if (!result.success) {
      throw new LlmSchemaError(result.error.issues.map((i) => i.message), json);
    }
    return { parsed: result.data, raw: raw.content, usage: raw.usage, model: this.model };
  }

  private async callWithRetry(
    system: string,
    user: string,
    maxTokens?: number,
  ): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number } }> {
    const first = await this.callOnce(system, user, maxTokens);
    if (this.looksLikeJson(first.content)) return first;
    const second = await this.callOnce(system, user + RETRY_SUFFIX, maxTokens);
    if (this.looksLikeJson(second.content)) return second;
    throw new LlmJsonParseError(second.content);
  }

  private async callOnce(
    system: string,
    user: string,
    maxTokens?: number,
  ): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number } }> {
    const res = await this.fetcher(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: this.temperature,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
      }),
    });
    if (!res.ok) {
      throw new LlmHttpError(res.status, await res.text());
    }
    const data = (await res.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content ?? "";
    if (!content) throw new LlmHttpError(200, "empty content");
    return {
      content,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }

  private looksLikeJson(s: string): boolean {
    const trimmed = s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return trimmed.startsWith("{") || trimmed.startsWith("[");
  }

  private parseJson(s: string): unknown {
    const trimmed = s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      throw new LlmJsonParseError(s, err);
    }
  }
}
