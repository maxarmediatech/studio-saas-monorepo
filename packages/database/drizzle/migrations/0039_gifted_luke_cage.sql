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
	CONSTRAINT "payment_idempotency_operation_check" CHECK (operation IN ('create_received_payment', 'convert_schedule_payment')),
	CONSTRAINT "payment_idempotency_status_check" CHECK (status IN ('processing', 'completed')),
	CONSTRAINT "payment_idempotency_completion_check" CHECK ((status = 'processing' AND result_resource_id IS NULL AND result_payload IS NULL AND completed_at IS NULL) OR (status = 'completed' AND result_resource_id IS NOT NULL AND result_payload IS NOT NULL AND completed_at IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "payment_idempotency_records" ADD CONSTRAINT "payment_idempotency_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_idempotency_records" ADD CONSTRAINT "payment_idempotency_records_result_resource_id_received_amounts_id_fk" FOREIGN KEY ("result_resource_id") REFERENCES "public"."received_amounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_idempotency_org_operation_key_idx" ON "payment_idempotency_records" USING btree ("organization_id","operation","idempotency_key");--> statement-breakpoint
CREATE INDEX "payment_idempotency_result_idx" ON "payment_idempotency_records" USING btree ("result_resource_id");