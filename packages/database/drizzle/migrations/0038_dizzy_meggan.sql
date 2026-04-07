CREATE TYPE "public"."wa_media_ingest_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
ALTER TABLE "wa_media" ADD COLUMN "ingest_status" "wa_media_ingest_status" DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "wa_media" ADD COLUMN "ingest_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wa_media" ADD COLUMN "last_ingest_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "wa_media" ADD COLUMN "next_ingest_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "wa_media" ADD COLUMN "ingest_error_message" text;