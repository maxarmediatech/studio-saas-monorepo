import { describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("financial document number allocation", () => {
	it("allocates distinct monotonic numbers and rolls back unused allocations", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;
		const { bookings, db, eq, invoices, organizations } = await import(
			"@repo/database"
		);
		const { allocateDocumentNumber } = await import(
			"./document-number-service"
		);
		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `document_sequence_org_${suffix}`;
		const bookingId = `document_sequence_booking_${suffix}`;
		const baseNumber = `INV-DOC-${suffix}`;

		try {
			await db.insert(organizations).values({
				id: organizationId,
				name: "Document sequence test",
				slug: `document-sequence-${suffix}`,
			});
			await db.insert(bookings).values({
				id: bookingId,
				organizationId,
				referenceNumber: `DOC-${suffix}`,
				name: "Document sequence booking",
				bookingType: "test",
				packageType: "test",
				packageCost: "100.00",
			});
			await db.insert(invoices).values([
				{
					organizationId,
					bookingId,
					invoiceNumber: baseNumber,
					issueDate: "2026-01-01",
				},
				{
					organizationId,
					bookingId,
					invoiceNumber: `${baseNumber}-2`,
					issueDate: "2026-01-01",
					deletedAt: new Date(),
				},
			]);

			const allocated = await Promise.all(
				Array.from({ length: 10 }, () =>
					db.transaction((tx) =>
						allocateDocumentNumber(tx, {
							organizationId,
							documentType: "invoice",
							baseNumber,
						}),
					),
				),
			);
			expect(new Set(allocated).size).toBe(10);
			expect(allocated.sort()).toEqual(
				Array.from(
					{ length: 10 },
					(_, index) => `${baseNumber}-${index + 3}`,
				).sort(),
			);

			await expect(
				db.transaction(async (tx) => {
					await allocateDocumentNumber(tx, {
						organizationId,
						documentType: "invoice",
						baseNumber,
					});
					throw new Error("rollback allocation");
				}),
			).rejects.toThrow("rollback allocation");
			const afterRollback = await db.transaction((tx) =>
				allocateDocumentNumber(tx, {
					organizationId,
					documentType: "invoice",
					baseNumber,
				}),
			);
			expect(afterRollback).toBe(`${baseNumber}-13`);

			const receiptNumber = await db.transaction((tx) =>
				allocateDocumentNumber(tx, {
					organizationId,
					documentType: "receipt",
					baseNumber,
				}),
			);
			expect(receiptNumber).toBe(baseNumber);
		} finally {
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
	});
});
