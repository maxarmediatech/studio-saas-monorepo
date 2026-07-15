-- Rebuild the booking profitability cache from the canonical allocation ledger.
-- Shoot expenses roll up to the shoot's parent booking; crew-only expenses are
-- organization overhead and do not contribute to a booking total.
-- Freeze the source rows and booking cache while the deterministic repair runs.
LOCK TABLE "expense_assignments", "expenses", "shoots" IN SHARE MODE;
LOCK TABLE "bookings" IN SHARE ROW EXCLUSIVE MODE;

UPDATE "bookings" AS b
SET "total_expenses" = coalesce((
	SELECT sum(
		CASE
			WHEN ea."allocation_amount" IS NOT NULL THEN ea."allocation_amount"
			WHEN ea."allocation_percentage" IS NOT NULL
				THEN e."amount" * ea."allocation_percentage" / 100
			ELSE e."amount"
		END
	)
	FROM "expense_assignments" AS ea
	JOIN "expenses" AS e
		ON e."id" = ea."expense_id"
		AND e."deleted_at" IS NULL
	LEFT JOIN "shoots" AS s
		ON s."id" = ea."shoot_id"
		AND s."deleted_at" IS NULL
	WHERE coalesce(ea."booking_id", s."booking_id") = b."id"
), 0),
"updated_at" = now();
