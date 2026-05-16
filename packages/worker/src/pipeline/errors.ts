export class PipelineError extends Error {
  constructor(
    public readonly stage: "C" | "D" | "E" | "persist",
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(`pipeline[${stage}]: ${message}`);
    this.name = "PipelineError";
  }
}
