DO $$ BEGIN
 CREATE TYPE "public"."tax_type" AS ENUM('exclusive', 'inclusive', 'no_gst');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "payment_schedules"
ADD COLUMN IF NOT EXISTS "tax_type" "tax_type" DEFAULT 'exclusive' NOT NULL;
