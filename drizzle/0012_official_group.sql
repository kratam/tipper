-- Add isOfficial flag to groups table for the per-tournament official group feature.
ALTER TABLE "groups" ADD COLUMN "is_official" boolean DEFAULT false NOT NULL;
