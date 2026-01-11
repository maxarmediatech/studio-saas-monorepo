CREATE TABLE "saved_view_favorites" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"saved_view_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"created_by" varchar(255),
	"entity_type" varchar(50) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" varchar(50),
	"color" varchar(20),
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"display_filters" jsonb,
	"column_visibility" jsonb,
	"sorting" jsonb,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_view_favorites" ADD CONSTRAINT "saved_view_favorites_saved_view_id_saved_views_id_fk" FOREIGN KEY ("saved_view_id") REFERENCES "public"."saved_views"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_view_favorites" ADD CONSTRAINT "saved_view_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_view_favorites_view_user_idx" ON "saved_view_favorites" USING btree ("saved_view_id","user_id");--> statement-breakpoint
CREATE INDEX "saved_view_favorites_user_idx" ON "saved_view_favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_views_org_idx" ON "saved_views" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "saved_views_org_entity_idx" ON "saved_views" USING btree ("organization_id","entity_type");--> statement-breakpoint
CREATE INDEX "saved_views_created_by_idx" ON "saved_views" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_views_org_entity_name_idx" ON "saved_views" USING btree ("organization_id","entity_type","name");