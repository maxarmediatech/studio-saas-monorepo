-- Repair historical booking caches from the canonical expense allocation ledger.
-- Shoot expenses roll up to the shoot's parent booking; crew-only expenses are
-- organization overhead and therefore do not contribute to a booking total.
UPDATE bookings b
SET total_expenses = coalesce((
	SELECT sum(
		CASE
			WHEN ea.allocation_amount IS NOT NULL THEN ea.allocation_amount
			WHEN ea.allocation_percentage IS NOT NULL
				THEN e.amount * ea.allocation_percentage / 100
			ELSE e.amount
		END
	)
	FROM expense_assignments ea
	JOIN expenses e ON e.id = ea.expense_id AND e.deleted_at IS NULL
	LEFT JOIN shoots s ON s.id = ea.shoot_id AND s.deleted_at IS NULL
	WHERE coalesce(ea.booking_id, s.booking_id) = b.id
), 0),
updated_at = now();
