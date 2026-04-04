-- Schedule override: fallback dates for tournaments with placeholder API schedules
ALTER TABLE "tournaments" ADD COLUMN "use_schedule_overrides" boolean DEFAULT false NOT NULL;

CREATE TABLE "match_schedule_overrides" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "match_id" uuid NOT NULL REFERENCES "matches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  "scheduled_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "match_schedule_overrides_match_id_unique" UNIQUE("match_id")
);
