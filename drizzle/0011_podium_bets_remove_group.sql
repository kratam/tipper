-- Remove group_id from podium_bets: one podium bet per user per tournament
DROP INDEX IF EXISTS "podium_unique_idx";
ALTER TABLE "podium_bets" DROP COLUMN IF EXISTS "group_id";
CREATE UNIQUE INDEX "podium_unique_idx" ON "podium_bets" ("user_id", "tournament_id");
