ALTER TABLE "google_calendar_connections" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "google_calendar_connections" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
DROP INDEX IF EXISTS "google_calendar_connections_org_user_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "google_calendar_connections_active_org_user_idx" ON "google_calendar_connections" ("organization_id", "user_id") WHERE "disconnected_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "google_calendar_connections_org_user_version_idx" ON "google_calendar_connections" ("organization_id", "user_id", "version");--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "delivery_sync_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "delivery_last_error" text;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "cancellation_sync_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD COLUMN "cancellation_last_error" text;--> statement-breakpoint
UPDATE "shoot_calendar_events" SET "delivery_sync_status" = "sync_status"::text, "delivery_last_error" = "last_error";--> statement-breakpoint
ALTER TABLE "calendar_delivery_intents" ADD COLUMN "google_connection_id" varchar(255) REFERENCES "google_calendar_connections"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "calendar_delivery_intents" ADD COLUMN "google_account_email" text;--> statement-breakpoint
UPDATE "calendar_delivery_intents" AS intent
SET
  "google_connection_id" = connection."id",
  "google_account_email" = connection."google_account_email",
  "payload" = jsonb_set(
    jsonb_set(intent."payload", '{target,googleConnectionId}', to_jsonb(connection."id"::text), true),
    '{target,googleAccountEmail}', to_jsonb(connection."google_account_email"::text), true
  )
FROM "google_calendar_connections" AS connection
WHERE intent."delivery_method" = 'google'
  AND intent."google_connection_id" IS NULL
  AND connection."organization_id" = intent."organization_id"
  AND connection."user_id" = intent."payload" #>> '{target,googleUserId}'
  AND connection."version" = (
    SELECT MAX(candidate."version")
    FROM "google_calendar_connections" AS candidate
    WHERE candidate."organization_id" = intent."organization_id"
      AND candidate."user_id" = intent."payload" #>> '{target,googleUserId}'
  );--> statement-breakpoint
ALTER TABLE "calendar_sync_jobs" ADD COLUMN "effect_state" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_sync_jobs" ADD COLUMN "provider_result" jsonb;--> statement-breakpoint
ALTER TABLE "calendar_sync_jobs" ADD COLUMN "compensation_sequence" integer;
--> statement-breakpoint
UPDATE "calendar_sync_jobs" AS job
SET "payload" = intent."payload"
FROM "calendar_delivery_intents" AS intent
WHERE job."intent_id" = intent."id"
  AND intent."delivery_method" = 'google';
--> statement-breakpoint
CREATE TABLE "calendar_route_changes" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "organization_id" varchar(255) NOT NULL,
  "crew_id" varchar(255) NOT NULL,
  "reason" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);--> statement-breakpoint
CREATE INDEX "calendar_route_changes_pending_idx" ON "calendar_route_changes" ("organization_id", "status");
