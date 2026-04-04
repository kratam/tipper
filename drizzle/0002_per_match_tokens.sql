-- Per-match token distribution: replace token_per_round/carryover_percent with new columns
ALTER TABLE "groups" ADD COLUMN "token_per_match" integer DEFAULT 100 NOT NULL;
ALTER TABLE "groups" ADD COLUMN "initial_tokens" integer DEFAULT 200 NOT NULL;
ALTER TABLE "groups" ADD COLUMN "distribution_days_before" integer DEFAULT 3 NOT NULL;

-- Migrate existing data: carry over the old token_per_round value
UPDATE "groups" SET "token_per_match" = "token_per_round";

ALTER TABLE "groups" DROP COLUMN "token_per_round";
ALTER TABLE "groups" DROP COLUMN "carryover_percent";
