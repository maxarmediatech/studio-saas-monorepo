ALTER TABLE "purchases" ADD COLUMN "plan_key" text DEFAULT 'legacy-unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "price_key" text DEFAULT 'legacy-unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "billing_interval" text;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "catalog_version" text DEFAULT '2026-04-basics' NOT NULL;--> statement-breakpoint
UPDATE "purchases"
SET
	"price_key" = CASE
		WHEN "product_id" <> '' THEN "product_id"
		ELSE "price_key"
	END,
	"billing_interval" = CASE
		WHEN "type" = 'ONE_TIME' THEN 'one_time'
		ELSE "billing_interval"
	END
WHERE "price_key" = 'legacy-unknown';
