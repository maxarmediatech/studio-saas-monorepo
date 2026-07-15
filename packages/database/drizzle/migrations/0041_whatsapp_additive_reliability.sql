CREATE TYPE "public"."wa_automation_action_status" AS ENUM('pending', 'processing', 'waiting', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."wa_automation_run_status" AS ENUM('pending', 'processing', 'waiting', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."wa_campaign_recipient_status" AS ENUM('pending', 'queued', 'sent', 'delivered', 'read', 'failed', 'suppressed', 'delivery_unknown');--> statement-breakpoint
CREATE TYPE "public"."wa_media_ingest_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
ALTER TYPE "public"."wa_message_status" ADD VALUE 'suppressed';--> statement-breakpoint
ALTER TYPE "public"."wa_message_status" ADD VALUE 'delivery_unknown';--> statement-breakpoint
ALTER TYPE "public"."wa_outbox_status" ADD VALUE 'suppressed';--> statement-breakpoint
ALTER TYPE "public"."wa_outbox_status" ADD VALUE 'delivery_unknown';--> statement-breakpoint
CREATE TABLE "wa_automation_actions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"run_id" varchar(255) NOT NULL,
	"flow_id" varchar(255) NOT NULL,
	"action_index" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "wa_automation_action_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"locked_by" text,
	"lease_expires_at" timestamp with time zone,
	"wait_until" timestamp with time zone,
	"message_id" varchar(255),
	"last_error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_automation_runs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"flow_id" varchar(255) NOT NULL,
	"trigger_identity" text NOT NULL,
	"inbound_message_id" varchar(255) NOT NULL,
	"contact_id" varchar(255) NOT NULL,
	"conversation_id" varchar(255) NOT NULL,
	"flow_version" integer NOT NULL,
	"action_snapshot" jsonb NOT NULL,
	"status" "wa_automation_run_status" DEFAULT 'pending' NOT NULL,
	"current_action_index" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"locked_by" text,
	"lease_expires_at" timestamp with time zone,
	"last_error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_campaign_recipients" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"campaign_id" varchar(255) NOT NULL,
	"contact_id" varchar(255) NOT NULL,
	"message_id" varchar(255),
	"status" "wa_campaign_recipient_status" DEFAULT 'pending' NOT NULL,
	"queued_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"suppressed_at" timestamp with time zone,
	"delivery_unknown_at" timestamp with time zone,
	"failure_code" text,
	"failure_message" text,
	"suppression_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_manual_send_idempotency" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"request_fingerprint" varchar(64) NOT NULL,
	"status" varchar(20) DEFAULT 'processing' NOT NULL,
	"message_id" varchar(255),
	"outbox_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "wa_manual_send_idempotency_status_check" CHECK (status IN ('processing', 'completed')),
	CONSTRAINT "wa_manual_send_idempotency_completion_check" CHECK ((status = 'processing' AND message_id IS NULL AND outbox_id IS NULL AND completed_at IS NULL) OR (status = 'completed' AND message_id IS NOT NULL AND outbox_id IS NOT NULL AND completed_at IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "wa_templates" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"provider_template_id" text,
	"name" text NOT NULL,
	"language" text NOT NULL,
	"status" text NOT NULL,
	"category" text NOT NULL,
	"components" jsonb,
	"rejected_reason" text,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wa_accounts" ADD COLUMN "api_version" text;--> statement-breakpoint
ALTER TABLE "wa_accounts" ADD COLUMN "app_secret" text;--> statement-breakpoint
ALTER TABLE "wa_accounts" ADD COLUMN "verified_name" text;--> statement-breakpoint
ALTER TABLE "wa_accounts" ADD COLUMN "quality_rating" text;--> statement-breakpoint
ALTER TABLE "wa_accounts" ADD COLUMN "messaging_limit_tier" text;--> statement-breakpoint
ALTER TABLE "wa_accounts" ADD COLUMN "last_validated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "wa_media" ADD COLUMN "ingest_status" "wa_media_ingest_status" DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "wa_media" ADD COLUMN "ingest_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wa_media" ADD COLUMN "last_ingest_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "wa_media" ADD COLUMN "next_ingest_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "wa_media" ADD COLUMN "ingest_locked_by" text;--> statement-breakpoint
ALTER TABLE "wa_media" ADD COLUMN "ingest_lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "wa_media" ADD COLUMN "ingest_error_message" text;--> statement-breakpoint
ALTER TABLE "wa_messages" ADD COLUMN "sent_by_campaign_id" varchar(255);--> statement-breakpoint
ALTER TABLE "wa_messages" ADD COLUMN "campaign_recipient_id" varchar(255);--> statement-breakpoint
ALTER TABLE "wa_messages" ADD COLUMN "automation_action_id" varchar(255);--> statement-breakpoint
ALTER TABLE "wa_events" ADD COLUMN "processing_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "wa_events" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wa_events" ADD COLUMN "max_attempts" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "wa_events" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "wa_events" ADD COLUMN "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "wa_events" ADD COLUMN "locked_by" text;--> statement-breakpoint
ALTER TABLE "wa_events" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "wa_outbox" ADD COLUMN "locked_by" text;--> statement-breakpoint
ALTER TABLE "wa_outbox" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "wa_outbox" ADD COLUMN "dispatch_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "wa_outbox" ADD COLUMN "dispatch_token" text;--> statement-breakpoint
ALTER TABLE "wa_campaigns" ADD COLUMN "audience_captured_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "wa_campaigns" ADD COLUMN "total_recipients" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "wa_campaigns" ADD COLUMN "total_queued" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "wa_campaigns" ADD COLUMN "total_suppressed" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "wa_campaigns" ADD COLUMN "total_delivery_unknown" integer DEFAULT 0;--> statement-breakpoint
CREATE FUNCTION "wa_events_preserve_retryable_failures"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NEW."processed_at" IS NOT NULL AND NEW."error_message" IS NOT NULL THEN
		NEW."processed_at" := NULL;
		NEW."processing_status" := 'pending';
		NEW."next_attempt_at" := now();
		NEW."locked_by" := NULL;
		NEW."lease_expires_at" := NULL;
	ELSIF NEW."processed_at" IS NOT NULL THEN
		NEW."processing_status" := 'processed';
		NEW."locked_by" := NULL;
		NEW."lease_expires_at" := NULL;
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "wa_events_preserve_retryable_failures_trigger"
BEFORE INSERT OR UPDATE OF "processed_at", "error_message" ON "wa_events"
FOR EACH ROW
EXECUTE FUNCTION "wa_events_preserve_retryable_failures"();--> statement-breakpoint
UPDATE "wa_events"
SET "processed_at" = NULL
WHERE "error_message" IS NOT NULL;--> statement-breakpoint
UPDATE "wa_events"
SET "processing_status" = 'processed'
WHERE "processed_at" IS NOT NULL;--> statement-breakpoint
WITH ambiguous AS (
	UPDATE "wa_outbox"
	SET "status" = 'failed',
		"attempts" = COALESCE("max_attempts", 3),
		"next_attempt_at" = NULL,
		"error_message" = 'Delivery was already processing before durable dispatch tracking; reconcile provider state before retrying'
	WHERE "status" = 'processing'
	RETURNING "message_id"
)
UPDATE "wa_messages"
SET "status" = 'failed',
	"status_updated_at" = now(),
	"error_message" = 'Delivery was already processing before durable dispatch tracking; reconcile provider state before retrying'
WHERE "id" IN (SELECT "message_id" FROM ambiguous);--> statement-breakpoint
CREATE UNIQUE INDEX "wa_automation_actions_run_index_idx" ON "wa_automation_actions" USING btree ("run_id","action_index");--> statement-breakpoint
CREATE UNIQUE INDEX "wa_automation_actions_message_idx" ON "wa_automation_actions" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "wa_automation_actions_queue_idx" ON "wa_automation_actions" USING btree ("status","next_attempt_at","wait_until");--> statement-breakpoint
CREATE INDEX "wa_automation_actions_lease_idx" ON "wa_automation_actions" USING btree ("lease_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wa_automation_runs_trigger_identity_idx" ON "wa_automation_runs" USING btree ("flow_id","trigger_identity");--> statement-breakpoint
CREATE INDEX "wa_automation_runs_queue_idx" ON "wa_automation_runs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "wa_automation_runs_lease_idx" ON "wa_automation_runs" USING btree ("lease_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wa_campaign_recipients_identity_idx" ON "wa_campaign_recipients" USING btree ("campaign_id","account_id","contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wa_campaign_recipients_message_idx" ON "wa_campaign_recipients" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "wa_campaign_recipients_campaign_status_idx" ON "wa_campaign_recipients" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "wa_campaign_recipients_account_idx" ON "wa_campaign_recipients" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wa_manual_send_idempotency_scope_key_idx" ON "wa_manual_send_idempotency" USING btree ("organization_id","actor_id","account_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "wa_manual_send_idempotency_message_idx" ON "wa_manual_send_idempotency" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "wa_manual_send_idempotency_outbox_idx" ON "wa_manual_send_idempotency" USING btree ("outbox_id");--> statement-breakpoint
CREATE INDEX "wa_templates_organization_id_idx" ON "wa_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "wa_templates_account_id_idx" ON "wa_templates" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "wa_templates_status_idx" ON "wa_templates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wa_templates_language_idx" ON "wa_templates" USING btree ("language");--> statement-breakpoint
CREATE UNIQUE INDEX "wa_templates_account_name_language_uidx" ON "wa_templates" USING btree ("account_id","name","language");--> statement-breakpoint
CREATE INDEX "wa_media_ingest_queue_idx" ON "wa_media" USING btree ("ingest_status","next_ingest_attempt_at");--> statement-breakpoint
CREATE INDEX "wa_media_ingest_lease_expiry_idx" ON "wa_media" USING btree ("ingest_lease_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wa_messages_campaign_recipient_idx" ON "wa_messages" USING btree ("campaign_recipient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wa_messages_automation_action_idx" ON "wa_messages" USING btree ("automation_action_id");--> statement-breakpoint
CREATE INDEX "wa_messages_sent_by_campaign_id_idx" ON "wa_messages" USING btree ("sent_by_campaign_id");--> statement-breakpoint
CREATE INDEX "wa_events_due_idx" ON "wa_events" USING btree ("processing_status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "wa_outbox_lease_expiry_idx" ON "wa_outbox" USING btree ("lease_expires_at");--> statement-breakpoint
CREATE INDEX "wa_outbox_dispatch_token_idx" ON "wa_outbox" USING btree ("dispatch_token");
