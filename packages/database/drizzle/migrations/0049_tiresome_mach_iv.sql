ALTER TABLE "wa_events" ADD COLUMN "processing_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "wa_events" ADD COLUMN "max_attempts" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "wa_events" ADD COLUMN "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "wa_events" ADD COLUMN "locked_by" text;--> statement-breakpoint
ALTER TABLE "wa_events" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
UPDATE "wa_events"
SET "processing_status" = 'processed'
WHERE "processed_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "wa_events_due_idx" ON "wa_events" USING btree ("processing_status","next_attempt_at");
