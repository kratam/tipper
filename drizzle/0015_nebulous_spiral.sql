CREATE TYPE "public"."provider" AS ENUM('api-sports', 'odds-api');--> statement-breakpoint
-- tournaments: provider discriminator + nullable provider-specific columns + flag fallback
ALTER TABLE "tournaments" ADD COLUMN "provider" "provider" DEFAULT 'api-sports' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "provider_sport" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "provider_league_slug" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "use_flag_fallback" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ALTER COLUMN "api_league_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ALTER COLUMN "api_season" DROP NOT NULL;--> statement-breakpoint
-- teams: provider namespace + external_id (backfilled from api_team_id), name kept
ALTER TABLE "teams" ADD COLUMN "provider" "provider" DEFAULT 'api-sports' NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "external_id" text;--> statement-breakpoint
UPDATE "teams" SET "external_id" = "api_team_id"::text;--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "external_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" DROP CONSTRAINT "teams_api_team_id_unique";--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "api_team_id";--> statement-breakpoint
CREATE UNIQUE INDEX "teams_provider_external_idx" ON "teams" USING btree ("provider","external_id");--> statement-breakpoint
-- matches: external_id (backfilled from api_game_id) + tournament-scoped unique
ALTER TABLE "matches" ADD COLUMN "external_id" text;--> statement-breakpoint
UPDATE "matches" SET "external_id" = "api_game_id"::text;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "external_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_api_game_id_unique";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "api_game_id";--> statement-breakpoint
CREATE UNIQUE INDEX "matches_tournament_external_idx" ON "matches" USING btree ("tournament_id","external_id");
