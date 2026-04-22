CREATE TABLE "wa_templates" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"provider_template_id" text,
	"name" text NOT NULL,
	"language" text NOT NULL,
	"status" text NOT NULL,
	"category" text NOT NULL,
	"components" jsonb,
	"rejected_reason" text,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "wa_templates_organization_id_idx" ON "wa_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "wa_templates_account_id_idx" ON "wa_templates" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "wa_templates_status_idx" ON "wa_templates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wa_templates_language_idx" ON "wa_templates" USING btree ("language");--> statement-breakpoint
CREATE UNIQUE INDEX "wa_templates_account_name_language_uidx" ON "wa_templates" USING btree ("account_id","name","language");