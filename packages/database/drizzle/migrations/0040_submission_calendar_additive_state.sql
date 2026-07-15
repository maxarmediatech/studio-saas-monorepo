ALTER TYPE "public"."calendar_delivery_method" ADD VALUE 'unsendable';--> statement-breakpoint
ALTER TYPE "public"."calendar_event_sync_status" ADD VALUE 'unsendable';--> statement-breakpoint
CREATE TABLE "calendar_delivery_intents" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"shoot_id" varchar(255) NOT NULL,
	"crew_id" varchar(255) NOT NULL,
	"generation" integer NOT NULL,
	"state" text NOT NULL,
	"delivery_method" "calendar_delivery_method" NOT NULL,
	"recipient_email" text,
	"calendar_id" text,
	"google_event_id" text,
	"ical_uid" text,
	"ical_sequence" integer DEFAULT 0 NOT NULL,
	"google_connection_id" varchar(255),
	"google_account_email" text,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_route_changes" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"crew_id" varchar(255) NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
DROP INDEX "google_calendar_connections_org_user_idx";--> statement-breakpoint
DROP INDEX "shoot_calendar_events_shoot_crew_idx";--> statement-breakpoint
ALTER TABLE "calendar_sync_jobs" ADD COLUMN "delivery_key" text DEFAULT 'legacy:' || gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_sync_jobs" ADD COLUMN "intent_id" varchar(255);--> statement-breakpoint
ALTER TABLE "calendar_sync_jobs" ADD COLUMN "generation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_sync_jobs" ADD COLUMN "claim_token" varchar(255);--> statement-breakpoint
ALTER TABLE "calendar_sync_jobs" ADD COLUMN "effect_state" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_sync_jobs" ADD COLUMN "provider_result" jsonb;--> statement-breakpoint
ALTER TABLE "calendar_sync_jobs" ADD COLUMN "compensation_sequence" integer;--> statement-breakpoint
ALTER TABLE "google_calendar_connections" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "google_calendar_connections" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "delivery_sync_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "delivery_last_error" text;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "cancellation_sync_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "cancellation_last_error" text;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "intent_generation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "intent_state" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "delivered_generation" integer;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "delivered_delivery_method" "calendar_delivery_method";--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "delivered_recipient_email" text;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "delivered_calendar_id" text;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "delivered_google_event_id" text;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "delivered_ical_uid" text;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "delivered_ical_sequence" integer;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD COLUMN "review_claimed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "shoot_calendar_events"
SET
	"delivery_sync_status" = "sync_status"::text,
	"delivery_last_error" = "last_error",
	"delivered_generation" = CASE WHEN "sync_status" = 'synced' THEN 0 ELSE NULL END,
	"delivered_delivery_method" = CASE WHEN "sync_status" = 'synced' THEN "delivery_method" ELSE NULL END,
	"delivered_recipient_email" = CASE WHEN "sync_status" = 'synced' THEN "recipient_email" ELSE NULL END,
	"delivered_calendar_id" = CASE WHEN "sync_status" = 'synced' THEN "calendar_id" ELSE NULL END,
	"delivered_google_event_id" = CASE WHEN "sync_status" = 'synced' THEN "google_event_id" ELSE NULL END,
	"delivered_ical_uid" = CASE WHEN "sync_status" = 'synced' THEN "ical_uid" ELSE NULL END,
	"delivered_ical_sequence" = CASE WHEN "sync_status" = 'synced' THEN "ical_sequence" ELSE NULL END;--> statement-breakpoint
UPDATE "assignment_submissions"
SET "review_claimed_at" = COALESCE("reviewed_at", "updated_at", "submitted_at", "created_at")
WHERE "status" = 'in_review'
	AND "reviewed_by" IS NOT NULL
	AND "review_claimed_at" IS NULL;--> statement-breakpoint
ALTER TABLE "calendar_delivery_intents" ADD CONSTRAINT "calendar_delivery_intents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_delivery_intents" ADD CONSTRAINT "calendar_delivery_intents_shoot_id_shoots_id_fk" FOREIGN KEY ("shoot_id") REFERENCES "public"."shoots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_delivery_intents" ADD CONSTRAINT "calendar_delivery_intents_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_delivery_intents" ADD CONSTRAINT "calendar_delivery_intents_google_connection_id_google_calendar_connections_id_fk" FOREIGN KEY ("google_connection_id") REFERENCES "public"."google_calendar_connections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_delivery_intents_org_target_generation_idx" ON "calendar_delivery_intents" USING btree ("organization_id","shoot_id","crew_id","generation");--> statement-breakpoint
CREATE INDEX "calendar_delivery_intents_org_target_idx" ON "calendar_delivery_intents" USING btree ("organization_id","shoot_id","crew_id");--> statement-breakpoint
CREATE INDEX "calendar_route_changes_pending_idx" ON "calendar_route_changes" USING btree ("organization_id","status");--> statement-breakpoint
ALTER TABLE "calendar_sync_jobs" ADD CONSTRAINT "calendar_sync_jobs_intent_id_calendar_delivery_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."calendar_delivery_intents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_sync_jobs_intent_idx" ON "calendar_sync_jobs" USING btree ("intent_id","generation");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_sync_jobs_active_delivery_key_idx" ON "calendar_sync_jobs" USING btree ("delivery_key") WHERE "calendar_sync_jobs"."status" <> 'completed';--> statement-breakpoint
CREATE UNIQUE INDEX "google_calendar_connections_active_org_user_idx" ON "google_calendar_connections" USING btree ("organization_id","user_id") WHERE "google_calendar_connections"."disconnected_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "google_calendar_connections_org_user_version_idx" ON "google_calendar_connections" USING btree ("organization_id","user_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "shoot_calendar_events_org_shoot_crew_idx" ON "shoot_calendar_events" USING btree ("organization_id","shoot_id","crew_id");--> statement-breakpoint
CREATE INDEX "assignment_submissions_review_claim_idx" ON "assignment_submissions" USING btree ("organization_id","status","review_claimed_at");
