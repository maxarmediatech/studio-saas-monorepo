import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

function restoreDatabaseUrl(original: string | undefined) {
	if (original === undefined) {
		delete process.env.DATABASE_URL;
	} else {
		process.env.DATABASE_URL = original;
	}
}

const delay = (milliseconds: number) =>
	new Promise((resolve) => setTimeout(resolve, milliseconds));

describePostgres("quote provenance locking", () => {
	it("blocks option evidence changes until sourced booking visibility", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;
		const {
			bookings,
			db,
			eq,
			organizations,
			quoteAcceptances,
			quoteLineItems,
			quoteOptions,
			quotes,
		} = await import("@repo/database");
		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `quote_race_org_${suffix}`;
		const quoteId = randomUUID();
		const optionId = randomUUID();
		const bookingId = randomUUID();
		const quoteNumber = `RACE-${suffix}`;
		const bookingBlueprint = {
			schemaVersion: 1,
			booking: {
				name: "Race booking",
				bookingDate: "2026-08-01",
				bookingType: "wedding",
				packageType: "premium",
			},
		};
		let releaseInsert = () => {};
		const holdInsert = new Promise<void>((resolve) => {
			releaseInsert = resolve;
		});

		try {
			await db.insert(organizations).values({
				id: organizationId,
				name: "Quote Race Studio",
				slug: `quote-race-${suffix}`,
			});
			await db.insert(quotes).values({
				id: quoteId,
				organizationId,
				quoteNumber,
				status: "accepted",
				title: "Race quote",
			});
			await db.transaction(async (tx) => {
				await tx.insert(quoteOptions).values({
					id: optionId,
					organizationId,
					quoteId,
					name: "Accepted",
					subtotal: "100.00",
					totalAmount: "100.00",
					bookingBlueprintVersion: 1,
					bookingBlueprint,
				});
				await tx.insert(quoteLineItems).values({
					organizationId,
					quoteOptionId: optionId,
					type: "service",
					description: "Coverage",
					quantity: "1.00",
					unitPrice: "100.00",
					amount: "100.00",
				});
			});
			await db.insert(quoteAcceptances).values({
				quoteId,
				organizationId,
				quoteOptionId: optionId,
				acceptedAt: new Date("2026-08-01T00:00:00.000Z"),
				optionSnapshot: {
					quoteId,
					quoteOptionId: optionId,
					quoteNumber,
					quoteVersion: 1,
					currency: "INR",
					acceptedAt: "2026-08-01T00:00:00.000Z",
					option: {
						name: "Accepted",
						subtotal: "100.00",
						discountAmount: "0.00",
						taxAmount: "0.00",
						totalAmount: "100.00",
						bookingBlueprint,
						isRecommended: false,
						sortOrder: 0,
						lineItems: [],
					},
				},
			});

			let insertReachedHold = () => {};
			const insertHeld = new Promise<void>((resolve) => {
				insertReachedHold = resolve;
			});
			const bookingInsert = db.transaction(async (tx) => {
				await tx.insert(bookings).values({
					id: bookingId,
					organizationId,
					referenceNumber: `RACE-${suffix}`,
					name: "Race booking",
					bookingType: "wedding",
					packageType: "premium",
					packageCost: "100.00",
					sourceQuoteId: quoteId,
					sourceQuoteOptionId: optionId,
					sourceQuoteNumber: quoteNumber,
					sourceQuoteVersion: 1,
					sourceBookingBlueprintVersion: 1,
				});
				insertReachedHold();
				await holdInsert;
			});
			await insertHeld;

			let updateSettled = false;
			const evidenceUpdate = db
				.update(quoteOptions)
				.set({
					subtotal: "101.00",
					totalAmount: "101.00",
				})
				.where(eq(quoteOptions.id, optionId))
				.then(
					() => ({ accepted: true as const }),
					(error: unknown) => ({ accepted: false as const, error }),
				)
				.finally(() => {
					updateSettled = true;
				});
			await delay(200);
			expect(updateSettled).toBe(false);
			releaseInsert();
			await bookingInsert;
			const updateResult = await evidenceUpdate;
			expect(updateResult.accepted).toBe(false);
			expect(
				(
					await db.query.quoteOptions.findFirst({
						where: eq(quoteOptions.id, optionId),
					})
				)?.totalAmount,
			).toBe("100.00");
			expect(
				await db.query.bookings.findFirst({
					where: eq(bookings.id, bookingId),
				}),
			).toBeDefined();
		} finally {
			releaseInsert();
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			restoreDatabaseUrl(originalDatabaseUrl);
		}
	}, 30_000);
});
