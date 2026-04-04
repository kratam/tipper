-- Add odds_boost column to groups table
ALTER TABLE "groups" ADD COLUMN "odds_boost" real DEFAULT 1.0 NOT NULL;
