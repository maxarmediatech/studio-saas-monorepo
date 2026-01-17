CREATE TYPE "public"."wa_bot_flow_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."wa_campaign_status" AS ENUM('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."wa_connection_status" AS ENUM('disconnected', 'connecting', 'qr_pending', 'connected', 'banned');--> statement-breakpoint
CREATE TYPE "public"."wa_conversation_status" AS ENUM('open', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."wa_media_storage_type" AS ENUM('local', 's3', 'provider');--> statement-breakpoint
CREATE TYPE "public"."wa_message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."wa_message_status" AS ENUM('pending', 'queued', 'sent', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "public"."wa_message_type" AS ENUM('text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact', 'template', 'interactive');--> statement-breakpoint
CREATE TYPE "public"."wa_outbox_status" AS ENUM('pending', 'processing', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."wa_ownership_type" AS ENUM('platform', 'customer');--> statement-breakpoint
CREATE TYPE "public"."wa_provider" AS ENUM('baileys', 'cloud_api');--> statement-breakpoint
CREATE TABLE "wa_accounts" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"phone_number" text,
	"display_phone_number" text,
	"provider" "wa_provider" NOT NULL,
	"connection_status" "wa_connection_status" DEFAULT 'disconnected' NOT NULL,
	"ownership_type" "wa_ownership_type" DEFAULT 'platform' NOT NULL,
	"session_key" text,
	"session_data" jsonb,
	"qr_code" text,
	"qr_expires_at" timestamp with time zone,
	"waba_id" text,
	"phone_number_id" text,
	"access_token" text,
	"webhook_verify_token" text,
	"last_connected_at" timestamp with time zone,
	"last_event_at" timestamp with time zone,
	"last_error_message" text,
	"error_count" integer DEFAULT 0,
	"webhook_url" text,
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wa_contacts" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"account_id" varchar(255),
	"wa_id" text NOT NULL,
	"phone_number" text NOT NULL,
	"push_name" text,
	"name" text,
	"email" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"custom_fields" jsonb,
	"assigned_to_user_id" text,
	"external_source" text,
	"external_id" text,
	"is_blocked" boolean DEFAULT false,
	"is_opted_out" boolean DEFAULT false,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_conversations" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"contact_id" varchar(255) NOT NULL,
	"status" "wa_conversation_status" DEFAULT 'open' NOT NULL,
	"unread_count" integer DEFAULT 0,
	"assigned_to_user_id" text,
	"last_message_id" varchar(255),
	"last_message_at" timestamp with time zone,
	"last_message_preview" text,
	"window_expires_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_media" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"provider_media_id" text,
	"mime_type" text NOT NULL,
	"file_name" text,
	"file_size" integer,
	"width" integer,
	"height" integer,
	"duration" integer,
	"storage_type" "wa_media_storage_type" DEFAULT 's3' NOT NULL,
	"storage_url" text,
	"thumbnail_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_messages" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"conversation_id" varchar(255) NOT NULL,
	"contact_id" varchar(255) NOT NULL,
	"provider_message_id" text,
	"provider_timestamp" timestamp with time zone,
	"direction" "wa_message_direction" NOT NULL,
	"type" "wa_message_type" NOT NULL,
	"text_body" text,
	"caption" text,
	"media_id" varchar(255),
	"template_name" text,
	"template_params" jsonb,
	"interactive_data" jsonb,
	"status" "wa_message_status" DEFAULT 'pending' NOT NULL,
	"status_updated_at" timestamp with time zone,
	"error_code" text,
	"error_message" text,
	"sent_by_user_id" text,
	"sent_by_bot_flow_id" varchar(255),
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_events" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"processed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_outbox" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"message_id" varchar(255) NOT NULL,
	"status" "wa_outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0,
	"max_attempts" integer DEFAULT 3,
	"last_attempt_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone,
	"error_message" text,
	"priority" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_campaigns" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "wa_campaign_status" DEFAULT 'draft' NOT NULL,
	"message_type" "wa_message_type" DEFAULT 'text' NOT NULL,
	"text_body" text,
	"template_name" text,
	"template_params" jsonb,
	"media_id" varchar(255),
	"audience_filter" jsonb,
	"estimated_recipients" integer DEFAULT 0,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"total_sent" integer DEFAULT 0,
	"total_delivered" integer DEFAULT 0,
	"total_read" integer DEFAULT 0,
	"total_failed" integer DEFAULT 0,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_bot_flows" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "wa_bot_flow_status" DEFAULT 'draft' NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"flow_data" jsonb,
	"trigger_type" text DEFAULT 'keyword' NOT NULL,
	"trigger_keywords" jsonb DEFAULT '[]'::jsonb,
	"total_triggered" integer DEFAULT 0,
	"last_triggered_at" timestamp with time zone,
	"created_by_user_id" text,
	"published_at" timestamp with time zone,
	"published_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "wa_accounts_organization_id_idx" ON "wa_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "wa_accounts_session_key_idx" ON "wa_accounts" USING btree ("session_key");--> statement-breakpoint
CREATE INDEX "wa_accounts_provider_idx" ON "wa_accounts" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "wa_accounts_connection_status_idx" ON "wa_accounts" USING btree ("connection_status");--> statement-breakpoint
CREATE INDEX "wa_contacts_organization_id_idx" ON "wa_contacts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "wa_contacts_account_id_idx" ON "wa_contacts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "wa_contacts_wa_id_idx" ON "wa_contacts" USING btree ("wa_id");--> statement-breakpoint
CREATE INDEX "wa_contacts_phone_number_idx" ON "wa_contacts" USING btree ("phone_number");--> statement-breakpoint
CREATE UNIQUE INDEX "wa_contacts_external_link_idx" ON "wa_contacts" USING btree ("organization_id","external_source","external_id");--> statement-breakpoint
CREATE INDEX "wa_conversations_organization_id_idx" ON "wa_conversations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "wa_conversations_account_id_idx" ON "wa_conversations" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "wa_conversations_contact_id_idx" ON "wa_conversations" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "wa_conversations_status_idx" ON "wa_conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wa_conversations_last_message_at_idx" ON "wa_conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wa_conversations_account_contact_idx" ON "wa_conversations" USING btree ("account_id","contact_id");--> statement-breakpoint
CREATE INDEX "wa_media_organization_id_idx" ON "wa_media" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "wa_media_provider_media_id_idx" ON "wa_media" USING btree ("provider_media_id");--> statement-breakpoint
CREATE INDEX "wa_messages_organization_id_idx" ON "wa_messages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "wa_messages_account_id_idx" ON "wa_messages" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "wa_messages_conversation_id_idx" ON "wa_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "wa_messages_contact_id_idx" ON "wa_messages" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "wa_messages_provider_message_id_idx" ON "wa_messages" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "wa_messages_created_at_idx" ON "wa_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "wa_messages_status_idx" ON "wa_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wa_events_organization_id_idx" ON "wa_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "wa_events_account_id_idx" ON "wa_events" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wa_events_idempotency_idx" ON "wa_events" USING btree ("account_id","provider_event_id");--> statement-breakpoint
CREATE INDEX "wa_outbox_organization_id_idx" ON "wa_outbox" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "wa_outbox_account_id_idx" ON "wa_outbox" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "wa_outbox_status_idx" ON "wa_outbox" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wa_outbox_next_attempt_idx" ON "wa_outbox" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "wa_outbox_queue_idx" ON "wa_outbox" USING btree ("status","next_attempt_at","priority");--> statement-breakpoint
CREATE INDEX "wa_campaigns_organization_id_idx" ON "wa_campaigns" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "wa_campaigns_account_id_idx" ON "wa_campaigns" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "wa_campaigns_status_idx" ON "wa_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wa_bot_flows_organization_id_idx" ON "wa_bot_flows" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "wa_bot_flows_account_id_idx" ON "wa_bot_flows" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "wa_bot_flows_status_idx" ON "wa_bot_flows" USING btree ("status");