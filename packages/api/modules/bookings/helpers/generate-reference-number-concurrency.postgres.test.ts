import { describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

function restoreDatabaseUrl(original: string | undefined) {
	if (original === undefined) {
		delete process.env.DATABASE_URL;
		return;
	}
	process.env.DATABASE_URL = original;
}

describePostgres("booking reference PostgreSQL concurrency", () => {
	it("allocates distinct references under real concurrent transactions", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;
		const { bookings, db, eq, organizations } = await import(
			"@repo/database"
		);
		const { generateBookingReferenceNumber } = await import(
			"./generate-reference-number"
		);
		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `booking_reference_org_${suffix}`;

		try {
			await db.insert(organizations).values({
				id: organizationId,
				name: "Concurrency Studio",
				slug: `booking-reference-${suffix}`,
			});
			const references = await Promise.all(
				Array.from({ length: 12 }, (_, index) =>
					db.transaction(async (tx) => {
						const referenceNumber =
							await generateBookingReferenceNumber(
								tx,
								organizationId,
								"Concurrency Studio",
								new Date("2026-04-15T00:00:00.000Z"),
							);
						await tx.insert(bookings).values({
							organizationId,
							referenceNumber,
							name: `Concurrent booking ${index}`,
							bookingType: "test",
							packageType: "test",
							packageCost: "100.00",
						});
						return referenceNumber;
					}),
				),
			);

			expect(new Set(references).size).toBe(12);
			expect(references.sort()).toEqual(
				Array.from(
					{ length: 12 },
					(_, index) =>
						`CS-2604-${String(index + 1).padStart(4, "0")}`,
				).sort(),
			);
		} finally {
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			restoreDatabaseUrl(originalDatabaseUrl);
		}
	});
});
