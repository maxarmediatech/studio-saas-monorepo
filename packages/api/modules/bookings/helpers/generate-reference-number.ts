import { ORPCError } from "@orpc/server";
import { and, bookings, eq, sql } from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";
import { deriveStudioPrefix } from "./derive-studio-prefix";

/** Format: {STUDIO_PREFIX}-{YYMM}-{XXXX}. */
export async function generateBookingReferenceNumber(
	tx: TransactionClient,
	organizationId: string,
	organizationName: string,
	now = new Date(),
): Promise<string> {
	const yearMonth = `${String(now.getFullYear()).slice(-2)}${String(
		now.getMonth() + 1,
	).padStart(2, "0")}`;
	const prefix = `${deriveStudioPrefix(organizationName)}-${yearMonth}-`;

	// Serialize reference allocation for this tenant/month inside the caller's
	// transaction. hashtextextended yields the bigint key advisory locks require.
	await tx.execute(
		sql`SELECT pg_advisory_xact_lock(hashtextextended(${`booking-reference:${organizationId}:${prefix}`}, 0))`,
	);

	const [lastBooking] = await tx
		.select({ referenceNumber: bookings.referenceNumber })
		.from(bookings)
		.where(
			and(
				eq(bookings.organizationId, organizationId),
				sql`${bookings.referenceNumber} LIKE ${`${prefix}%`}`,
			),
		)
		.orderBy(sql`${bookings.referenceNumber} DESC`)
		.limit(1);

	const parsed = lastBooking?.referenceNumber
		? Number.parseInt(lastBooking.referenceNumber.slice(-4), 10)
		: 0;
	const nextNumber = Number.isNaN(parsed) ? 1 : parsed + 1;
	if (nextNumber > 9999) {
		throw new ORPCError("CONFLICT", {
			message:
				"Monthly booking reference limit reached (max 9,999 per organization)",
		});
	}
	return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}
