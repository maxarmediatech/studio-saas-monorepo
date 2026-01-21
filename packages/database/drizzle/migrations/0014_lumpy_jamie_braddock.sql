CREATE TABLE "discussion_mentions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"mentioned_user_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discussion_messages" ADD COLUMN "content_json" jsonb;--> statement-breakpoint
ALTER TABLE "discussion_messages" ADD COLUMN "content_text" text;--> statement-breakpoint
ALTER TABLE "discussion_messages" ADD COLUMN "schema_version" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "discussions" ADD COLUMN "content_json" jsonb;--> statement-breakpoint
ALTER TABLE "discussions" ADD COLUMN "content_text" text;--> statement-breakpoint
ALTER TABLE "discussions" ADD COLUMN "schema_version" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "discussion_mentions" ADD CONSTRAINT "discussion_mentions_mentioned_user_id_users_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discussion_mentions_unique" ON "discussion_mentions" USING btree ("entity_type","entity_id","mentioned_user_id");--> statement-breakpoint
CREATE INDEX "discussion_mentions_user_idx" ON "discussion_mentions" USING btree ("mentioned_user_id");--> statement-breakpoint
CREATE INDEX "discussion_mentions_entity_idx" ON "discussion_mentions" USING btree ("entity_type","entity_id");