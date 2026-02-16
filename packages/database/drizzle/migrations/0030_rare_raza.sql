CREATE TYPE "public"."line_item_type" AS ENUM('milestone', 'item', 'service', 'expense');--> statement-breakpoint
ALTER TABLE "invoice_line_items" DROP CONSTRAINT IF EXISTS "invoice_line_items_quantity_positive";--> statement-breakpoint
ALTER TABLE "invoice_line_items" DROP CONSTRAINT IF EXISTS "invoice_line_items_unit_price_non_negative";--> statement-breakpoint
ALTER TABLE "invoice_line_items" DROP CONSTRAINT IF EXISTS "invoice_line_items_amount_consistency";--> statement-breakpoint
ALTER TABLE "invoice_line_items" ALTER COLUMN "quantity" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ALTER COLUMN "unit_price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ALTER COLUMN "quantity" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "type" "line_item_type" DEFAULT 'item' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_itemized_check" CHECK (CASE WHEN type IN ('item', 'service') THEN quantity IS NOT NULL AND quantity > 0 AND unit_price IS NOT NULL AND unit_price >= 0 AND amount = quantity * unit_price ELSE TRUE END);--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_lump_sum_check" CHECK (CASE WHEN type IN ('milestone', 'expense') THEN quantity IS NULL AND unit_price IS NULL AND amount >= 0 ELSE TRUE END);
