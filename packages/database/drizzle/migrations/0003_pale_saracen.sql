CREATE TABLE "activities" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"actor_id" varchar(255) NOT NULL,
	"actor_type" varchar(20) NOT NULL,
	"actor_name" text NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"entity_name" text NOT NULL,
	"parent_entity_type" varchar(50),
	"parent_entity_id" varchar(255),
	"parent_entity_name" text,
	"action" varchar(50) NOT NULL,
	"field" varchar(50),
	"old_value" text,
	"new_value" text,
	"old_identifier" varchar(255),
	"new_identifier" varchar(255),
	"epoch" numeric(20, 6),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_org_created_idx" ON "activities" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "activities_entity_idx" ON "activities" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "activities_actor_idx" ON "activities" USING btree ("actor_id","actor_type","created_at");--> statement-breakpoint
CREATE INDEX "activities_parent_idx" ON "activities" USING btree ("parent_entity_type","parent_entity_id","created_at");--> statement-breakpoint
CREATE INDEX "activities_org_action_idx" ON "activities" USING btree ("organization_id","action");