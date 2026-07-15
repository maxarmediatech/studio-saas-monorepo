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
CREATE TABLE "payment_idempotency_records" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"operation" varchar(50) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"request_fingerprint" varchar(64) NOT NULL,
	"status" varchar(20) DEFAULT 'processing' NOT NULL,
	"result_resource_id" varchar(255),
	"result_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "payment_idempotency_operation_check" CHECK (operation IN ('create_received_payment', 'convert_schedule_payment', 'correct_received_payment')),
	CONSTRAINT "payment_idempotency_status_check" CHECK (status IN ('processing', 'completed')),
	CONSTRAINT "payment_idempotency_completion_check" CHECK ((status = 'processing' AND result_resource_id IS NULL AND result_payload IS NULL AND completed_at IS NULL) OR (status = 'completed' AND result_resource_id IS NOT NULL AND result_payload IS NOT NULL AND completed_at IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "received_amounts" ADD COLUMN "replaces_payment_id" varchar(255);--> statement-breakpoint
ALTER TABLE "received_amounts" ADD COLUMN "replacement_payment_id" varchar(255);--> statement-breakpoint
ALTER TABLE "received_amounts" ADD COLUMN "reversed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "received_amounts" ADD COLUMN "reversed_by" varchar(255);--> statement-breakpoint
ALTER TABLE "received_amounts" ADD COLUMN "reversal_reason" text;--> statement-breakpoint
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_idempotency_records" ADD CONSTRAINT "payment_idempotency_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_idempotency_records" ADD CONSTRAINT "payment_idempotency_records_result_resource_id_received_amounts_id_fk" FOREIGN KEY ("result_resource_id") REFERENCES "public"."received_amounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_sequences_org_type_scope_idx" ON "document_sequences" USING btree ("organization_id","document_type","scope_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_idempotency_org_operation_key_idx" ON "payment_idempotency_records" USING btree ("organization_id","operation","idempotency_key");--> statement-breakpoint
CREATE INDEX "payment_idempotency_result_idx" ON "payment_idempotency_records" USING btree ("result_resource_id");--> statement-breakpoint
ALTER TABLE "received_amounts" ADD CONSTRAINT "received_amounts_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_amounts" ADD CONSTRAINT "received_amounts_replaces_payment_id_fk" FOREIGN KEY ("replaces_payment_id") REFERENCES "public"."received_amounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_amounts" ADD CONSTRAINT "received_amounts_replacement_payment_id_fk" FOREIGN KEY ("replacement_payment_id") REFERENCES "public"."received_amounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "received_amounts_replaces_payment_idx" ON "received_amounts" USING btree ("replaces_payment_id") WHERE replaces_payment_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "received_amounts_replacement_payment_idx" ON "received_amounts" USING btree ("replacement_payment_id") WHERE replacement_payment_id IS NOT NULL;