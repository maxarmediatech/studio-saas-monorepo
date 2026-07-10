ALTER TYPE "public"."calendar_delivery_method" ADD VALUE IF NOT EXISTS 'unsendable';--> statement-breakpoint
ALTER TYPE "public"."calendar_event_sync_status" ADD VALUE IF NOT EXISTS 'unsendable';--> statement-breakpoint
DROP INDEX IF EXISTS "shoot_calendar_events_shoot_crew_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "shoot_calendar_events_org_shoot_crew_idx"
ON "shoot_calendar_events" USING btree ("organization_id", "shoot_id", "crew_id");--> statement-breakpoint
ALTER TABLE "calendar_sync_jobs" ADD COLUMN "delivery_key" text;--> statement-breakpoint
UPDATE "calendar_sync_jobs"
SET "delivery_key" = 'legacy:' || "id"
WHERE "delivery_key" IS NULL;--> statement-breakpoint
ALTER TABLE "calendar_sync_jobs" ALTER COLUMN "delivery_key" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_sync_jobs_active_delivery_key_idx"
ON "calendar_sync_jobs" USING btree ("delivery_key")
WHERE "calendar_sync_jobs"."status" <> 'completed';
--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "intent_generation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "intent_state" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "delivered_generation" integer;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "delivered_delivery_method" "calendar_delivery_method";--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "delivered_recipient_email" text;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "delivered_calendar_id" text;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "delivered_google_event_id" text;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "delivered_ical_uid" text;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "delivered_ical_sequence" integer;--> statement-breakpoint
CREATE TABLE "calendar_delivery_intents" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
	"shoot_id" varchar(255) NOT NULL REFERENCES "shoots"("id") ON DELETE cascade,
	"crew_id" varchar(255) NOT NULL REFERENCES "crews"("id") ON DELETE cascade,
	"generation" integer NOT NULL,
	"state" text NOT NULL,
	"delivery_method" "calendar_delivery_method" NOT NULL,
	"recipient_email" text,
	"calendar_id" text,
	"google_event_id" text,
	"ical_uid" text,
	"ical_sequence" integer DEFAULT 0 NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_delivery_intents_org_target_generation_idx"
ON "calendar_delivery_intents" USING btree ("organization_id", "shoot_id", "crew_id", "generation");--> statement-breakpoint
CREATE INDEX "calendar_delivery_intents_org_target_idx"
ON "calendar_delivery_intents" USING btree ("organization_id", "shoot_id", "crew_id");--> statement-breakpoint
ALTER TABLE "calendar_sync_jobs" ADD COLUMN "intent_id" varchar(255) REFERENCES "calendar_delivery_intents"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "calendar_sync_jobs" ADD COLUMN "generation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_sync_jobs" ADD COLUMN "claim_token" varchar(255);--> statement-breakpoint
CREATE INDEX "calendar_sync_jobs_intent_idx"
ON "calendar_sync_jobs" USING btree ("intent_id", "generation");
