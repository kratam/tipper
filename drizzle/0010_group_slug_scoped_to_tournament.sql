-- Scope group slugs to tournament instead of globally unique
ALTER TABLE "groups" DROP CONSTRAINT "groups_slug_unique";
CREATE UNIQUE INDEX "group_tournament_slug_idx" ON "groups" ("tournament_id", "slug");
