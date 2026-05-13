-- Add isArchived flag to tournaments table for hiding finished tournaments
-- from listings while keeping group members' access intact.
ALTER TABLE "tournaments" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;
