import { NotEnoughSignalError } from "./errors.js";

export function preflightCheck(reportId: string, mentionCount: number): void {
  if (mentionCount < 20) {
    throw new NotEnoughSignalError(reportId, mentionCount);
  }
}
