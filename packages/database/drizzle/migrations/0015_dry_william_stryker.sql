CREATE TYPE "public"."checkin_frequency" AS ENUM('daily', 'weekdays', 'weekly');--> statement-breakpoint
CREATE TABLE "checkin_comments" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"checkin_id" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"content_json" jsonb,
	"content_text" text,
	"content_schema_version" integer DEFAULT 1 NOT NULL,
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
CREATE TABLE "checkin_links" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"checkin_id" varchar(255) NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkin_types" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"emoji" varchar(10),
	"description" text,
	"frequency" "checkin_frequency" NOT NULL,
	"scheduled_time" time,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "checkins" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"checkin_type_id" varchar(255) NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"content" text,
	"content_json" jsonb,
	"content_text" text,
	"content_schema_version" integer DEFAULT 1 NOT NULL,
	"checkin_date" date NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "checkin_comments" ADD CONSTRAINT "checkin_comments_checkin_id_checkins_id_fk" FOREIGN KEY ("checkin_id") REFERENCES "public"."checkins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_comments" ADD CONSTRAINT "checkin_comments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_comments" ADD CONSTRAINT "checkin_comments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_comments" ADD CONSTRAINT "checkin_comments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_links" ADD CONSTRAINT "checkin_links_checkin_id_checkins_id_fk" FOREIGN KEY ("checkin_id") REFERENCES "public"."checkins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_links" ADD CONSTRAINT "checkin_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_links" ADD CONSTRAINT "checkin_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_types" ADD CONSTRAINT "checkin_types_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_types" ADD CONSTRAINT "checkin_types_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_types" ADD CONSTRAINT "checkin_types_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_types" ADD CONSTRAINT "checkin_types_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_types" ADD CONSTRAINT "checkin_types_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_checkin_type_id_checkin_types_id_fk" FOREIGN KEY ("checkin_type_id") REFERENCES "public"."checkin_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkin_comments_checkin_idx" ON "checkin_comments" USING btree ("checkin_id","created_at");--> statement-breakpoint
CREATE INDEX "checkin_comments_thread_idx" ON "checkin_comments" USING btree ("thread_root_id","created_at");--> statement-breakpoint
CREATE INDEX "checkin_comments_parent_idx" ON "checkin_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checkin_links_unique" ON "checkin_links" USING btree ("checkin_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "checkin_links_checkin_idx" ON "checkin_links" USING btree ("checkin_id");--> statement-breakpoint
CREATE INDEX "checkin_links_entity_idx" ON "checkin_links" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "checkin_types_org_idx" ON "checkin_types" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "checkin_types_team_idx" ON "checkin_types" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "checkin_types_org_team_idx" ON "checkin_types" USING btree ("organization_id","team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checkins_type_user_date_unique" ON "checkins" USING btree ("checkin_type_id","created_by","checkin_date") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "checkins_type_date_idx" ON "checkins" USING btree ("checkin_type_id","checkin_date","created_at");--> statement-breakpoint
CREATE INDEX "checkins_org_created_idx" ON "checkins" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "checkins_user_date_idx" ON "checkins" USING btree ("created_by","checkin_date");