-- Add loss_percentage column to groups table.
-- Existing rows are backfilled to 100 (current behavior: full loss on incorrect 1X2 bets).
-- New rows default to 90 (10% refund on losses).
ALTER TABLE "groups" ADD COLUMN "loss_percentage" integer DEFAULT 100 NOT NULL;
ALTER TABLE "groups" ALTER COLUMN "loss_percentage" SET DEFAULT 90;
