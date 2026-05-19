type PipelineEngine = "postgres" | "inngest";

const VALID_ENGINES: readonly string[] = ["postgres", "inngest"];

export function getPipelineEngine(): PipelineEngine {
  const engine = process.env.REPORT_PIPELINE_ENGINE ?? "postgres";

  if (!VALID_ENGINES.includes(engine)) {
    throw new Error(
      `Invalid REPORT_PIPELINE_ENGINE: ${engine}. Must be one of: ${VALID_ENGINES.join(", ")}`
    );
  }

  return engine as PipelineEngine;
}

export { type PipelineEngine };
