ALTER TABLE "competitors" ADD CONSTRAINT "competitors_owner_slug_uniq" UNIQUE("owner_id","slug");
