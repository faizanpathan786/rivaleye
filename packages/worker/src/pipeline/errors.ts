export class NotEnoughSignalError extends Error {
  readonly mentionCount: number;
  readonly reportId: string;
  constructor(reportId: string, mentionCount: number) {
    super(`Not enough signal: ${mentionCount} mentions for report ${reportId} (min 20)`);
    this.name = "NotEnoughSignalError";
    this.reportId = reportId;
    this.mentionCount = mentionCount;
  }
}

export class StageValidationError extends Error {
  readonly stage: number;
  readonly lastRaw: unknown;
  constructor(stage: number, message: string, lastRaw?: unknown) {
    super(`Stage ${stage} validation failed: ${message}`);
    this.name = "StageValidationError";
    this.stage = stage;
    this.lastRaw = lastRaw;
  }
}

export class FinalShapeError extends Error {
  override readonly cause: unknown;
  constructor(cause: unknown) {
    super(`Final report shape validation failed: ${String(cause)}`);
    this.name = "FinalShapeError";
    this.cause = cause;
  }
}

export class EvidenceIntegrityError extends Error {
  readonly droppedCount: number;
  constructor(droppedCount: number, total: number) {
    super(`Evidence integrity: dropped ${droppedCount}/${total} claims (>${Math.round((droppedCount / total) * 100)}%)`);
    this.name = "EvidenceIntegrityError";
    this.droppedCount = droppedCount;
  }
}
