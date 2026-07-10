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
