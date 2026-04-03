ALTER TABLE "tournaments" ADD COLUMN "gold_team_id" uuid;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "silver_team_id" uuid;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "bronze_team_id" uuid;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_gold_team_id_teams_id_fk" FOREIGN KEY ("gold_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_silver_team_id_teams_id_fk" FOREIGN KEY ("silver_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_bronze_team_id_teams_id_fk" FOREIGN KEY ("bronze_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;