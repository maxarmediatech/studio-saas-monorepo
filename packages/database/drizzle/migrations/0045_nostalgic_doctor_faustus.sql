CREATE TYPE "public"."wa_media_ingest_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
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
ALTER TABLE "wa_media" ADD COLUMN "ingest_error_message" text;--> statement-breakpoint
ALTER TABLE "wa_messages" ADD COLUMN "sent_by_campaign_id" varchar(255);--> statement-breakpoint
CREATE INDEX "wa_templates_organization_id_idx" ON "wa_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "wa_templates_account_id_idx" ON "wa_templates" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "wa_templates_status_idx" ON "wa_templates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wa_templates_language_idx" ON "wa_templates" USING btree ("language");--> statement-breakpoint
CREATE UNIQUE INDEX "wa_templates_account_name_language_uidx" ON "wa_templates" USING btree ("account_id","name","language");--> statement-breakpoint
CREATE INDEX "wa_messages_sent_by_campaign_id_idx" ON "wa_messages" USING btree ("sent_by_campaign_id");