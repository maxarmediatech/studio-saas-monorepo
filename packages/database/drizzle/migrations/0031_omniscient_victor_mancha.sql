UPDATE "sms_outbox" SET "attempts" = 0 WHERE "attempts" IS NULL;--> statement-breakpoint
UPDATE "sms_outbox" SET "max_attempts" = 3 WHERE "max_attempts" IS NULL;--> statement-breakpoint
ALTER TABLE "sms_outbox" ALTER COLUMN "attempts" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sms_outbox" ALTER COLUMN "max_attempts" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "sms_outbox_organization_status_idx" ON "sms_outbox" USING btree ("organization_id","status");
