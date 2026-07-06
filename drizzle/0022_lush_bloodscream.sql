ALTER TABLE "groups" ADD COLUMN "bonus_goal_diff_pct" real DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "bonus_exact_score_pct" real DEFAULT 3 NOT NULL;