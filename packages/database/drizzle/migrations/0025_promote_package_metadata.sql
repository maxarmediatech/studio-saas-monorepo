ALTER TABLE "configurations" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "configurations" ADD COLUMN "default_cost" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "configurations" ADD COLUMN "booking_type_filter" varchar(100);
--> statement-breakpoint
-- NOTE: Regex intentionally allows unlimited decimal places (unlike the API schema's
-- 2-decimal limit) so historical metadata values like "1500.999" are rounded by
-- numeric(12,2) rather than silently discarded as NULL.
UPDATE "configurations"
SET
  default_cost = CASE
    WHEN TRIM(COALESCE(metadata->>'defaultCost', '')) ~ '^\d+(\.\d+)?$'
    THEN TRIM(metadata->>'defaultCost')::numeric
    ELSE NULL
  END,
  booking_type_filter = NULLIF(TRIM(COALESCE(metadata->>'bookingType', '')), '')
WHERE type = 'package_type'
  AND metadata IS NOT NULL;
