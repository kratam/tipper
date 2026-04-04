-- Add isPublic and description columns to groups table
ALTER TABLE "groups" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;
ALTER TABLE "groups" ADD COLUMN "description" text;
