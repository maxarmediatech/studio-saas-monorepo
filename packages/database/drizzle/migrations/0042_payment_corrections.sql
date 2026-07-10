ALTER TABLE "payment_idempotency_records" DROP CONSTRAINT "payment_idempotency_operation_check";--> statement-breakpoint
ALTER TABLE "received_amounts" ADD COLUMN "replaces_payment_id" varchar(255);--> statement-breakpoint
ALTER TABLE "received_amounts" ADD COLUMN "replacement_payment_id" varchar(255);--> statement-breakpoint
ALTER TABLE "received_amounts" ADD COLUMN "reversed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "received_amounts" ADD COLUMN "reversed_by" varchar(255);--> statement-breakpoint
ALTER TABLE "received_amounts" ADD COLUMN "reversal_reason" text;--> statement-breakpoint
ALTER TABLE "received_amounts" ADD CONSTRAINT "received_amounts_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_amounts" ADD CONSTRAINT "received_amounts_replaces_payment_id_fk" FOREIGN KEY ("replaces_payment_id") REFERENCES "public"."received_amounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_amounts" ADD CONSTRAINT "received_amounts_replacement_payment_id_fk" FOREIGN KEY ("replacement_payment_id") REFERENCES "public"."received_amounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "received_amounts_replaces_payment_idx" ON "received_amounts" USING btree ("replaces_payment_id") WHERE replaces_payment_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "received_amounts_replacement_payment_idx" ON "received_amounts" USING btree ("replacement_payment_id") WHERE replacement_payment_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_idempotency_records" ADD CONSTRAINT "payment_idempotency_operation_check" CHECK (operation IN ('create_received_payment', 'convert_schedule_payment', 'correct_received_payment'));