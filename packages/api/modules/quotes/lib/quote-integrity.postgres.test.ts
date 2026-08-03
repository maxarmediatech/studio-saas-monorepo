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

function blueprint(name = "Integrity booking") {
	return {
		schemaVersion: 1,
		booking: {
			name,
			bookingDate: "2026-08-01",
			bookingType: "wedding",
			packageType: "premium",
		},
	};
}

function snapshot(params: {
	quoteId: string;
	optionId: string;
	quoteNumber: string;
	version: number;
	total: string;
}) {
	return {
		quoteId: params.quoteId,
		quoteOptionId: params.optionId,
		quoteNumber: params.quoteNumber,
		quoteVersion: params.version,
		currency: "INR",
		acceptedAt: "2026-08-01T00:00:00.000Z",
		option: {
			name: "Accepted",
			subtotal: "100.00",
			discountAmount: "10.00",
			taxAmount: "5.00",
			totalAmount: params.total,
			bookingBlueprint: blueprint(),
			isRecommended: true,
			sortOrder: 0,
			lineItems: [
				{
					type: "service",
					description: "Coverage",
					quantity: "1.00",
					unitPrice: "100.00",
					amount: "100.00",
					sortOrder: 0,
				},
			],
		},
	};
}

describePostgres("quote database integrity", () => {
	it("enforces immutable canonical conversion evidence and tenant-safe deletion", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;
		const {
			bookings,
			clients,
			db,
			eq,
			organizations,
			quoteAcceptances,
			quoteLineItems,
			quoteOptions,
			quoteParticipants,
			quotes,
			users,
		} = await import("@repo/database");
		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `quote_integrity_org_${suffix}`;
		const userId = `quote_integrity_user_${suffix}`;
		const previousQuoteId = randomUUID();
		const quoteId = randomUUID();
		const clientId = randomUUID();
		const optionId = randomUUID();
		const otherOptionId = randomUUID();
		const bookingId = randomUUID();
		const quoteNumber = `QI-Q-2608-${suffix.slice(-4)}`;

		try {
			await db.insert(users).values({
				id: userId,
				name: "Integrity user",
				email: `integrity-${suffix}@example.com`,
			});
			await db.insert(organizations).values({
				id: organizationId,
				name: "Quote Integrity Studio",
				slug: `quote-integrity-${suffix}`,
			});
			await db.insert(clients).values({
				id: clientId,
				organizationId,
				name: "Integrity client",
			});
			await db.insert(quotes).values([
				{
					id: previousQuoteId,
					organizationId,
					quoteNumber,
					version: 1,
					status: "superseded",
					title: "Integrity quote v1",
				},
				{
					id: quoteId,
					organizationId,
					quoteNumber,
					version: 2,
					supersedesQuoteId: previousQuoteId,
					status: "accepted",
					title: "Integrity quote v2",
				},
			]);
			await db.insert(quoteParticipants).values({
				organizationId,
				quoteId,
				clientId,
				role: "primary",
				isPrimary: true,
			});
			await db.transaction(async (tx) => {
				await tx.insert(quoteOptions).values([
					{
						id: optionId,
						organizationId,
						quoteId,
						name: "Accepted",
						subtotal: "100.00",
						discountAmount: "10.00",
						taxAmount: "5.00",
						totalAmount: "95.00",
						bookingBlueprintVersion: 1,
						bookingBlueprint: blueprint(),
						isRecommended: true,
						sortOrder: 0,
					},
					{
						id: otherOptionId,
						organizationId,
						quoteId,
						name: "Other",
						subtotal: "0.00",
						totalAmount: "0.00",
						bookingBlueprintVersion: 1,
						bookingBlueprint: blueprint("Other"),
						sortOrder: 1,
					},
				]);
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
				optionSnapshot: snapshot({
					quoteId,
					optionId,
					quoteNumber,
					version: 2,
					total: "95.00",
				}),
				acceptedAt: new Date("2026-08-01T00:00:00.000Z"),
				acceptedBy: userId,
			});

			await expect(
				db
					.update(quoteAcceptances)
					.set({ acceptedAt: new Date("2026-08-02T00:00:00.000Z") })
					.where(eq(quoteAcceptances.quoteId, quoteId)),
			).rejects.toThrow();
			await expect(
				db
					.delete(quoteAcceptances)
					.where(eq(quoteAcceptances.quoteId, quoteId)),
			).rejects.toThrow();

			await expect(
				db.insert(bookings).values({
					organizationId,
					referenceNumber: `BAD-COST-${suffix}`,
					name: "Bad cost",
					bookingType: "wedding",
					packageType: "premium",
					packageCost: "96.00",
					sourceQuoteId: quoteId,
					sourceQuoteOptionId: optionId,
					sourceQuoteNumber: quoteNumber,
					sourceQuoteVersion: 2,
					sourceBookingBlueprintVersion: 1,
				}),
			).rejects.toThrow();
			await db.insert(bookings).values({
				id: bookingId,
				organizationId,
				referenceNumber: `QI-${suffix}`,
				name: "Integrity booking",
				bookingType: "wedding",
				packageType: "premium",
				packageCost: "95.00",
				sourceQuoteId: quoteId,
				sourceQuoteOptionId: optionId,
				sourceQuoteNumber: quoteNumber,
				sourceQuoteVersion: 2,
				sourceBookingBlueprintVersion: 1,
			});

			await expect(
				db
					.update(bookings)
					.set({
						sourceQuoteId: null,
						sourceQuoteOptionId: null,
						sourceQuoteNumber: null,
						sourceQuoteVersion: null,
						sourceBookingBlueprintVersion: null,
					})
					.where(eq(bookings.id, bookingId)),
			).rejects.toThrow();
			await expect(
				db
					.update(bookings)
					.set({ packageCost: "1.00" })
					.where(eq(bookings.id, bookingId)),
			).rejects.toThrow();
			for (const mutation of [
				{ sourceQuoteOptionId: otherOptionId },
				{ sourceQuoteNumber: `${quoteNumber}-WRONG` },
				{ sourceQuoteVersion: 3 },
				{ sourceBookingBlueprintVersion: 2 },
			]) {
				await expect(
					db
						.update(bookings)
						.set(mutation)
						.where(eq(bookings.id, bookingId)),
				).rejects.toThrow();
			}
			await expect(
				db.insert(bookings).values({
					organizationId,
					referenceNumber: `SECOND-${suffix}`,
					name: "Second conversion",
					bookingType: "wedding",
					packageType: "premium",
					packageCost: "95.00",
					sourceQuoteId: quoteId,
					sourceQuoteOptionId: optionId,
					sourceQuoteNumber: quoteNumber,
					sourceQuoteVersion: 2,
					sourceBookingBlueprintVersion: 1,
				}),
			).rejects.toThrow();

			for (const mutation of [
				{ optionSnapshot: { tampered: true } },
				{ acceptedAt: new Date("2026-08-02T00:00:00.000Z") },
				{ acceptedBy: null },
				{ quoteOptionId: otherOptionId },
			]) {
				await expect(
					db
						.update(quoteAcceptances)
						.set(mutation)
						.where(eq(quoteAcceptances.quoteId, quoteId)),
				).rejects.toThrow();
			}
			for (const mutation of [
				{ subtotal: "101.00", totalAmount: "96.00" },
				{ discountAmount: "9.00", totalAmount: "96.00" },
				{ taxAmount: "6.00", totalAmount: "96.00" },
				{ totalAmount: "96.00" },
				{ bookingBlueprint: blueprint("Tampered") },
				{ bookingBlueprintVersion: 2 },
			]) {
				await expect(
					db
						.update(quoteOptions)
						.set(mutation)
						.where(eq(quoteOptions.id, optionId)),
				).rejects.toThrow();
			}
			await expect(
				db
					.update(quotes)
					.set({ quoteNumber: `${quoteNumber}-MUTATED` })
					.where(eq(quotes.id, quoteId)),
			).rejects.toThrow();
			await expect(
				db.insert(quoteLineItems).values({
					organizationId,
					quoteOptionId: optionId,
					type: "expense",
					description: "Tampered line",
					amount: "1.00",
				}),
			).rejects.toThrow();
			await expect(
				db
					.update(quoteLineItems)
					.set({ amount: "99.00", unitPrice: "99.00" })
					.where(eq(quoteLineItems.quoteOptionId, optionId)),
			).rejects.toThrow();
			await expect(
				db
					.delete(quoteLineItems)
					.where(eq(quoteLineItems.quoteOptionId, optionId)),
			).rejects.toThrow();
			await expect(
				db.delete(clients).where(eq(clients.id, clientId)),
			).rejects.toThrow();

			await db
				.update(quotes)
				.set({ status: "converted", convertedAt: new Date() })
				.where(eq(quotes.id, quoteId));
			await expect(
				db
					.delete(organizations)
					.where(eq(organizations.id, organizationId)),
			).resolves.toBeDefined();
			expect(
				await db.query.bookings.findFirst({
					where: eq(bookings.id, bookingId),
				}),
			).toBeUndefined();
		} finally {
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			await db.delete(users).where(eq(users.id, userId));
			restoreDatabaseUrl(originalDatabaseUrl);
		}
	}, 30_000);

	it("enforces deferred subtotal arithmetic and exact acyclic lineage", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;
		const { db, eq, organizations, quoteLineItems, quoteOptions, quotes } =
			await import("@repo/database");
		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `quote_math_org_${suffix}`;
		const quoteId = randomUUID();
		const quoteNumber = `MATH-${suffix}`;
		try {
			await db.insert(organizations).values({
				id: organizationId,
				name: "Quote Math Studio",
				slug: `quote-math-${suffix}`,
			});
			await db.insert(quotes).values({
				id: quoteId,
				organizationId,
				quoteNumber,
				title: "Math quote",
			});
			await expect(
				db.transaction(async (tx) => {
					const optionId = randomUUID();
					await tx.insert(quoteOptions).values({
						id: optionId,
						organizationId,
						quoteId,
						name: "Mismatch",
						subtotal: "10.00",
						totalAmount: "10.00",
						bookingBlueprintVersion: 1,
						bookingBlueprint: blueprint(),
					});
					await tx.insert(quoteLineItems).values({
						organizationId,
						quoteOptionId: optionId,
						type: "expense",
						description: "Only nine",
						amount: "9.00",
					});
				}),
			).rejects.toThrow();

			const validOptionId = randomUUID();
			await expect(
				db.transaction(async (tx) => {
					await tx.insert(quoteOptions).values({
						id: validOptionId,
						organizationId,
						quoteId,
						name: "Valid",
						subtotal: "10.00",
						totalAmount: "10.00",
						bookingBlueprintVersion: 1,
						bookingBlueprint: blueprint(),
					});
					await tx.insert(quoteLineItems).values({
						organizationId,
						quoteOptionId: validOptionId,
						type: "expense",
						description: "Ten",
						amount: "10.00",
					});
				}),
			).resolves.toBeUndefined();
			expect(
				await db.query.quoteLineItems.findMany({
					where: eq(quoteLineItems.quoteOptionId, validOptionId),
				}),
			).toHaveLength(1);

			await expect(
				db.insert(quotes).values({
					organizationId,
					quoteNumber: `${quoteNumber}-WRONG`,
					version: 2,
					supersedesQuoteId: quoteId,
					title: "Wrong number",
				}),
			).rejects.toThrow();
			await expect(
				db.insert(quotes).values({
					organizationId,
					quoteNumber,
					version: 3,
					supersedesQuoteId: quoteId,
					title: "Skipped version",
				}),
			).rejects.toThrow();
			const childId = randomUUID();
			await db.insert(quotes).values({
				id: childId,
				organizationId,
				quoteNumber,
				version: 2,
				supersedesQuoteId: quoteId,
				title: "Valid child",
			});
			await expect(
				db
					.update(quotes)
					.set({ version: 3, supersedesQuoteId: childId })
					.where(eq(quotes.id, quoteId)),
			).rejects.toThrow();
		} finally {
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			restoreDatabaseUrl(originalDatabaseUrl);
		}
	}, 30_000);
});
