import { type db, sql } from "@repo/database";

type ExpenseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Rebuild every affected booking total from the allocation ledger.
 * Booking rows are locked in stable order so concurrent expense mutations
 * cannot overwrite one another with totals calculated from stale snapshots.
 */
export async function refreshBookingExpenseTotalsForExpense(
	tx: ExpenseTransaction,
	expenseId: string,
	updatedBy: string | null,
) {
	const affected = await tx.execute<{ booking_id: string }>(sql`
		SELECT DISTINCT coalesce(ea.booking_id, s.booking_id) AS booking_id
		FROM expense_assignments ea
		LEFT JOIN shoots s ON s.id = ea.shoot_id
		WHERE ea.expense_id = ${expenseId}
		  AND coalesce(ea.booking_id, s.booking_id) IS NOT NULL
		ORDER BY booking_id
	`);
	const bookingIds = affected.rows.map((row) => row.booking_id);
	if (bookingIds.length === 0) {
		return;
	}

	await tx.execute(sql`
		SELECT id
		FROM bookings
		WHERE id IN (${sql.join(
			bookingIds.map((id) => sql`${id}`),
			sql`, `,
		)})
		ORDER BY id
		FOR UPDATE
	`);

	await tx.execute(sql`
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
		updated_at = now(),
		updated_by = ${updatedBy}
		WHERE b.id IN (${sql.join(
			bookingIds.map((id) => sql`${id}`),
			sql`, `,
		)})
	`);
}
