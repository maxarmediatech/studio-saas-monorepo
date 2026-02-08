ALTER TABLE "receipts" DROP CONSTRAINT "receipts_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "receipts" DROP CONSTRAINT "receipts_received_amount_id_received_amounts_id_fk";
--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_received_amount_id_received_amounts_id_fk" FOREIGN KEY ("received_amount_id") REFERENCES "public"."received_amounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "received_amounts_invoice_idx" ON "received_amounts" USING btree ("invoice_id");