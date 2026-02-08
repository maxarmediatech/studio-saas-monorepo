ALTER TABLE "sms_outbox" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sms_outbox" ADD COLUMN "locked_by" text;--> statement-breakpoint
ALTER TABLE "sms_outbox" ADD COLUMN "processing_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sms_outbox" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sms_outbox" ADD COLUMN "provider_status_code" integer;--> statement-breakpoint
ALTER TABLE "sms_outbox" ADD COLUMN "error_code" text;--> statement-breakpoint
ALTER TABLE "sms_outbox" ADD COLUMN "is_permanent_failure" boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX "sms_outbox_immediate_queue_idx" ON "sms_outbox" USING btree ("status","next_attempt_at") WHERE "sms_outbox"."status" = 'pending' AND "sms_outbox"."next_attempt_at" IS NULL;--> statement-breakpoint
CREATE INDEX "sms_outbox_scheduled_queue_idx" ON "sms_outbox" USING btree ("status","next_attempt_at") WHERE "sms_outbox"."status" = 'pending' AND "sms_outbox"."next_attempt_at" IS NOT NULL;