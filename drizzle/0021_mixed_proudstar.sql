CREATE TABLE "user_badge_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"badge_key" text NOT NULL,
	"event_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"badge_key" text NOT NULL,
	"tier" integer NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"best_value" numeric(8, 2),
	"first_earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_badge_events" ADD CONSTRAINT "user_badge_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_badge_event_idx" ON "user_badge_events" USING btree ("user_id","badge_key","event_key");--> statement-breakpoint
CREATE UNIQUE INDEX "user_badge_idx" ON "user_badges" USING btree ("user_id","badge_key");--> statement-breakpoint
CREATE INDEX "user_badges_user_idx" ON "user_badges" USING btree ("user_id");