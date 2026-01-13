CREATE TABLE "stickies" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"title" varchar(255),
	"content" text,
	"color" varchar(50) DEFAULT 'yellow' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stickies" ADD CONSTRAINT "stickies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stickies" ADD CONSTRAINT "stickies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stickies_org_user_idx" ON "stickies" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "stickies_org_user_sort_idx" ON "stickies" USING btree ("organization_id","user_id","sort_order");