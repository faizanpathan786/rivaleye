-- Ensure rerun_requested column exists on synthesis_jobs (already in 0013 but formalizing)
-- This allows synthesis jobs to request re-synthesis when late platforms arrive
ALTER TABLE "synthesis_jobs" ADD COLUMN IF NOT EXISTS "rerun_requested" boolean DEFAULT false NOT NULL;
