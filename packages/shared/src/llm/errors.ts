export class LlmJsonParseError extends Error {
  constructor(public readonly raw: string, public override readonly cause?: unknown) {
    super(`LLM returned unparseable JSON (${raw.length} chars)`);
    this.name = "LlmJsonParseError";
  }
}

export class LlmHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(`OpenRouter HTTP ${status}: ${message}`);
    this.name = "LlmHttpError";
  }
}

export class LlmSchemaError extends Error {
  constructor(public readonly issues: string[], public readonly raw: unknown) {
    super(`LLM JSON did not match schema: ${issues.join("; ")}`);
    this.name = "LlmSchemaError";
  }
}
