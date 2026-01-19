CREATE TABLE IF NOT EXISTS "organization_roles" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"permission" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#6366f1',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'organization_roles_organization_id_organizations_id_fk'
	) THEN
		ALTER TABLE "organization_roles"
			ADD CONSTRAINT "organization_roles_organization_id_organizations_id_fk"
			FOREIGN KEY ("organization_id")
			REFERENCES "public"."organizations"("id")
			ON DELETE cascade
			ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_roles_org_id_idx" ON "organization_roles" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_roles_role_idx" ON "organization_roles" USING btree ("role");
