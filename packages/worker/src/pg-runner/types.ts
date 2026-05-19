/**
 * PostgreSQL Runner Type Definitions
 *
 * Types for job rows, configuration, and worker state.
 * These types define the shape of data for:
 * - Source jobs (platform-specific scraping tasks)
 * - Synthesis jobs (LLM clustering and report generation)
 * - Worker configuration and polling behavior
 *
 * Enum-derived types are imported from api schema (single source of truth).
 */

import type {
  SourceJobStatus,
  SynthesisJobStatus,
  ReportPlatformStage,
} from "../../../api/src/db/schema/pipeline";

export type {
  SourceJobStatus,
  SynthesisJobStatus,
  ReportPlatformStage,
};

/**
 * Compatibility alias: SourceJobStatus used by default.
 * Use SynthesisJobStatus explicitly when working with synthesis_jobs table.
 */
export type JobStatus = SourceJobStatus;

/**
 * Represents a source job row from report_platform_jobs table.
 *
 * A source job is one platform's scraping task for a given report.
 * Multiple source jobs run in parallel (one per platform).
 */
export type SourceJobRow = {
  /** Unique job identifier (UUID) */
  id: string;

  /** Report this job belongs to (UUID) */
  report_id: string;

  /** Platform identifier (e.g., "reddit", "g2", "capterra") */
  platform: string;

  /** Current job status (queued, running, completed, or failed) */
  status: SourceJobStatus;

  /** Current processing stage within source job pipeline */
  stage: ReportPlatformStage;

  /** Number of attempts already made */
  attempt_count: number;

  /** Maximum number of attempts before permanent failure */
  max_attempts: number;

  /** Timestamp when this job becomes eligible for processing */
  run_after: Date;

  /** Timestamp when the worker locked this job (null if not locked) */
  locked_at: Date | null;

  /** Worker ID that holds the lock (null if not locked) */
  locked_by: string | null;

  /** Timestamp when job execution started (null if not started) */
  started_at: Date | null;

  /** Timestamp when job completed or failed (null if still in progress) */
  completed_at: Date | null;

  /** Error message from last failure (null if no error) */
  last_error: string | null;
};

/**
 * Represents a synthesis job row from synthesis_jobs table.
 *
 * A synthesis job is a single report's LLM clustering and report generation.
 * Runs after all source jobs are completed (fan-in pattern).
 */
export type SynthesisJobRow = {
  /** Unique job identifier (UUID) */
  id: string;

  /** Report this job belongs to (UUID) */
  report_id: string;

  /** Current job status (queued, running, completed, failed, or cancelled) */
  status: SynthesisJobStatus;

  /** Number of attempts already made */
  attempt_count: number;

  /** Maximum number of attempts before permanent failure */
  max_attempts: number;

  /** Timestamp when this job becomes eligible for processing */
  run_after: Date;

  /** Timestamp when the worker locked this job (null if not locked) */
  locked_at: Date | null;

  /** Worker ID that holds the lock (null if not locked) */
  locked_by: string | null;

  /** Timestamp when job execution started (null if not started) */
  started_at: Date | null;

  /** Timestamp when job completed or failed (null if still in progress) */
  completed_at: Date | null;

  /** Error message from last failure (null if no error) */
  last_error: string | null;
};

/**
 * Configuration for a pg-runner worker instance.
 *
 * Passed to polling loops, recovery logic, and locking mechanisms.
 * Each worker process gets a unique ID to prevent lock conflicts.
 */
export type WorkerConfig = {
  /** Unique worker identifier (format: hostname:pid:random) */
  workerId: string;

  /** Poll interval in milliseconds (1000–2000 recommended) */
  pollIntervalMs: number;

  /**
   * Timeout in minutes before a source job is considered stale
   * and eligible for recovery (default: 15 minutes).
   * If a job is locked for longer than this, another worker
   * can claim and retry it.
   */
  sourceJobTimeoutMinutes: number;

  /**
   * Timeout in minutes before a synthesis job is considered stale
   * and eligible for recovery (default: 30 minutes).
   * If a job is locked for longer than this, another worker
   * can claim and retry it.
   */
  synthesisJobTimeoutMinutes: number;
};
