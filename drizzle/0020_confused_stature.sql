CREATE TYPE "public"."notification_type" AS ENUM('system', 'badge');--> statement-breakpoint
CREATE TABLE "notification_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text,
	"body" text,
	"data" jsonb,
	"href" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_object_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_notification_object_id_notification_objects_id_fk" FOREIGN KEY ("notification_object_id") REFERENCES "public"."notification_objects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_object_user_idx" ON "notification_recipients" USING btree ("notification_object_id","user_id");--> statement-breakpoint
CREATE INDEX "notification_user_read_idx" ON "notification_recipients" USING btree ("user_id","read_at");