ALTER TABLE "groups" ADD COLUMN "bonus_podium_mention_pct" real DEFAULT 1.5 NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "bonus_podium_exact_pct" real DEFAULT 3 NOT NULL;