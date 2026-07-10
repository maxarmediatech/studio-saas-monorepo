CREATE TABLE "document_sequences" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"document_type" varchar(32) NOT NULL,
	"scope_key" varchar(255) NOT NULL,
	"next_value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_sequences_type_check" CHECK (document_type IN ('invoice', 'receipt')),
	CONSTRAINT "document_sequences_next_value_positive" CHECK (next_value > 0)
);
--> statement-breakpoint
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_sequences_org_type_scope_idx" ON "document_sequences" USING btree ("organization_id","document_type","scope_key");