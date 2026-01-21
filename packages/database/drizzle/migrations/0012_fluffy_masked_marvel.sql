CREATE TYPE "public"."channel_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."discussion_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TABLE "channel_members" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"channel_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"is_subscribed" boolean DEFAULT true NOT NULL,
	"last_read_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"emoji" varchar(20) DEFAULT '💬',
	"visibility" "channel_visibility" DEFAULT 'public' NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "discussion_links" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"discussion_id" varchar(255) NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussion_messages" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"discussion_id" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"parent_id" varchar(255),
	"thread_root_id" varchar(255),
	"reply_count" integer DEFAULT 0 NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "discussions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"channel_id" varchar(255) NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"status" "discussion_status" DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by" varchar(255),
	"resolved_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_links" ADD CONSTRAINT "discussion_links_discussion_id_discussions_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_links" ADD CONSTRAINT "discussion_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_links" ADD CONSTRAINT "discussion_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_messages" ADD CONSTRAINT "discussion_messages_discussion_id_discussions_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_messages" ADD CONSTRAINT "discussion_messages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_messages" ADD CONSTRAINT "discussion_messages_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_messages" ADD CONSTRAINT "discussion_messages_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_members_channel_user_unique" ON "channel_members" USING btree ("channel_id","user_id");--> statement-breakpoint
CREATE INDEX "channel_members_user_idx" ON "channel_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channels_org_slug_unique" ON "channels" USING btree ("organization_id","slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "channels_org_idx" ON "channels" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discussion_links_unique" ON "discussion_links" USING btree ("discussion_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "discussion_links_discussion_idx" ON "discussion_links" USING btree ("discussion_id");--> statement-breakpoint
CREATE INDEX "discussion_links_entity_idx" ON "discussion_links" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "discussion_messages_discussion_idx" ON "discussion_messages" USING btree ("discussion_id","created_at");--> statement-breakpoint
CREATE INDEX "discussion_messages_thread_idx" ON "discussion_messages" USING btree ("thread_root_id","created_at");--> statement-breakpoint
CREATE INDEX "discussion_messages_parent_idx" ON "discussion_messages" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "discussions_channel_created_idx" ON "discussions" USING btree ("channel_id","created_at","id");--> statement-breakpoint
CREATE INDEX "discussions_org_channel_cursor_idx" ON "discussions" USING btree ("organization_id","channel_id","created_at","id");--> statement-breakpoint
CREATE INDEX "discussions_channel_activity_idx" ON "discussions" USING btree ("channel_id","last_activity_at");--> statement-breakpoint
CREATE INDEX "discussions_org_idx" ON "discussions" USING btree ("organization_id");