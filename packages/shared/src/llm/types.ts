import type { ZodSchema } from "zod";

export interface LlmRequest<TSchema extends ZodSchema | undefined = undefined> {
  system: string;
  user: string;
  schema?: TSchema;
  maxTokens?: number;
  /** Call-site label (e.g. "stage-a:reddit") used by the mock provider for
   *  fixture lookup and later for per-stage cost logging. Best-effort. */
  tag?: string;
}

export interface LlmCallOptions {
  timeoutMs?: number;
  maxAttempts?: number;
}

export interface LlmResponse<T> {
  parsed: T;
  raw: string;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

export interface LlmClient {
  complete<T>(req: LlmRequest<ZodSchema<T>>, opts?: LlmCallOptions): Promise<LlmResponse<T>>;
  complete(req: LlmRequest, opts?: LlmCallOptions): Promise<LlmResponse<string>>;
}
