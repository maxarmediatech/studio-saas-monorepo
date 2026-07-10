ALTER TABLE "organizations" ADD COLUMN "billing_seat_count" integer;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "billing_seat_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "billing_seat_sync_error" text;