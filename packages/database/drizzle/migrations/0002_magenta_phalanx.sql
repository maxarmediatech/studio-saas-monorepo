ALTER TABLE "purchases" ADD COLUMN "payment_id" text;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_payment_id_unique" UNIQUE("payment_id");