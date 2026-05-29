-- Idempotent: this constraint exists on some envs from an earlier hand-applied
-- step. Wrap in a DO block so the migration succeeds whether or not it does.
DO $$ BEGIN
  ALTER TABLE "competitors" ADD CONSTRAINT "competitors_owner_slug_uniq" UNIQUE("owner_id","slug");
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;
