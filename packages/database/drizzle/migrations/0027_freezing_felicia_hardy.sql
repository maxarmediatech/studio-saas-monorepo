CREATE TYPE "public"."tax_type" AS ENUM('exclusive', 'inclusive', 'no_gst');--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "tax_type" "tax_type" DEFAULT 'exclusive' NOT NULL;