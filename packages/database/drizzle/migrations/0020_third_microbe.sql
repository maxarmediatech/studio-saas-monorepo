ALTER TYPE "public"."config_type" ADD VALUE 'gst_rate';--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"booking_id" varchar(255) NOT NULL,
	"invoice_id" varchar(255),
	"received_amount_id" varchar(255),
	"receipt_number" varchar(50) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" varchar(50),
	"receipt_date" date NOT NULL,
	"notes" text,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255),
	CONSTRAINT "receipts_amount_positive" CHECK (amount > 0)
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "payment_schedule_id" varchar(255);--> statement-breakpoint
ALTER TABLE "received_amounts" ADD COLUMN "invoice_id" varchar(255);--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_received_amount_id_received_amounts_id_fk" FOREIGN KEY ("received_amount_id") REFERENCES "public"."received_amounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receipts_org_idx" ON "receipts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "receipts_booking_idx" ON "receipts" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "receipts_invoice_idx" ON "receipts" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "receipts_received_amount_idx" ON "receipts" USING btree ("received_amount_id");--> statement-breakpoint
CREATE INDEX "receipts_date_idx" ON "receipts" USING btree ("receipt_date");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_org_number_idx" ON "receipts" USING btree ("organization_id","receipt_number") WHERE deleted_at IS NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_schedule_id_payment_schedules_id_fk" FOREIGN KEY ("payment_schedule_id") REFERENCES "public"."payment_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_amounts" ADD CONSTRAINT "received_amounts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;