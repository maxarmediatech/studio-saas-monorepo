ALTER TABLE "discussion_messages" ADD COLUMN IF NOT EXISTS "content_json" jsonb;--> statement-breakpoint
ALTER TABLE "discussion_messages" ADD COLUMN IF NOT EXISTS "content_text" text;--> statement-breakpoint
ALTER TABLE "discussion_messages" ADD COLUMN IF NOT EXISTS "content_schema_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "discussions" ADD COLUMN IF NOT EXISTS "content_json" jsonb;--> statement-breakpoint
ALTER TABLE "discussions" ADD COLUMN IF NOT EXISTS "content_text" text;--> statement-breakpoint
ALTER TABLE "discussions" ADD COLUMN IF NOT EXISTS "content_schema_version" integer DEFAULT 1 NOT NULL;
