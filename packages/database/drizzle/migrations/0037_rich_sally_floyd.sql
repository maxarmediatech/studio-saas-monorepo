ALTER TABLE "wa_accounts" ADD COLUMN "api_version" text;--> statement-breakpoint
ALTER TABLE "wa_accounts" ADD COLUMN "app_secret" text;--> statement-breakpoint
ALTER TABLE "wa_accounts" ADD COLUMN "verified_name" text;--> statement-breakpoint
ALTER TABLE "wa_accounts" ADD COLUMN "quality_rating" text;--> statement-breakpoint
ALTER TABLE "wa_accounts" ADD COLUMN "messaging_limit_tier" text;--> statement-breakpoint
ALTER TABLE "wa_accounts" ADD COLUMN "last_validated_at" timestamp with time zone;