CREATE TYPE "public"."sms_status" AS ENUM('pending', 'processing', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "sms_outbox" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"phone_number" text NOT NULL,
	"template_id" varchar(255) NOT NULL,
	"variables" jsonb,
	"status" "sms_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0,
	"max_attempts" integer DEFAULT 3,
	"next_attempt_at" timestamp with time zone,
	"error_message" text,
	"provider_message_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sms_outbox_organization_id_idx" ON "sms_outbox" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sms_outbox_status_idx" ON "sms_outbox" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sms_outbox_next_attempt_idx" ON "sms_outbox" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "sms_outbox_queue_idx" ON "sms_outbox" USING btree ("status","next_attempt_at");