import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("document quotation child immutability", () => {
	it("cannot move participants, options, or line items out of a sent quote", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;
		const {
			clients,
			db,
			eq,
			organizations,
			quoteLineItems,
			quoteOptions,
			quoteParticipants,
			quotes,
		} = await import("@repo/database");
		const suffix = randomUUID();
		const organizationId = `quote-child-org-${suffix}`;
		const clientId = randomUUID();
		const sentQuoteId = randomUUID();
		const draftQuoteId = randomUUID();
		const optionId = randomUUID();
		const draftOptionId = randomUUID();
		const document = {
			schemaVersion: 1,
			quotationDate: "2026-08-03",
			quotationType: { id: null, key: null, label: "Wedding" },
			title: "Immutable quotation",
			currency: "INR",
			participants: [],
			events: [],
			packages: [],
			recommendedPackageKey: null,
			deliveryTimelines: [],
			paymentMilestones: [],
			fixedTerms: [],
		};
		const bookingBlueprint = {
			schemaVersion: 1 as const,
			booking: {
				name: "Immutable booking",
				bookingDate: "2026-08-03",
				bookingType: "wedding",
				packageType: "classic",
			},
		};
		try {
			await db.insert(organizations).values({
				id: organizationId,
				name: "Quotation child studio",
				slug: `quote-child-${suffix}`,
			});
			await db.insert(clients).values({
				id: clientId,
				organizationId,
				name: "Immutable client",
			});
			await db.insert(quotes).values([
				{
					id: sentQuoteId,
					organizationId,
					quoteNumber: `IMM-${suffix}`,
					status: "draft",
					title: "Sent",
					documentVersion: 1,
					document,
					documentSha256: "a".repeat(64),
					documentRevision: 1,
				},
				{
					id: draftQuoteId,
					organizationId,
					quoteNumber: `IMM-DRAFT-${suffix}`,
					status: "draft",
					title: "Draft",
					documentVersion: 1,
					document,
					documentSha256: "b".repeat(64),
					documentRevision: 1,
				},
			]);
			await db.insert(quoteParticipants).values({
				organizationId,
				quoteId: sentQuoteId,
				clientId,
				role: "primary_client",
			});
			await db.insert(quoteOptions).values([
				{
					id: optionId,
					organizationId,
					quoteId: sentQuoteId,
					name: "Sent option",
					subtotal: "100.00",
					totalAmount: "100.00",
					bookingBlueprint,
				},
				{
					id: draftOptionId,
					organizationId,
					quoteId: draftQuoteId,
					name: "Draft option",
					subtotal: "100.00",
					totalAmount: "100.00",
					bookingBlueprint,
				},
			]);
			await db.insert(quoteLineItems).values({
				organizationId,
				quoteOptionId: optionId,
				type: "service",
				description: "Immutable line",
				amount: "100.00",
			});
			await db
				.update(quotes)
				.set({ status: "sent" })
				.where(eq(quotes.id, sentQuoteId));
			await expect(
				db
					.update(quoteParticipants)
					.set({ quoteId: draftQuoteId })
					.where(eq(quoteParticipants.quoteId, sentQuoteId)),
			).rejects.toThrow();
			await expect(
				db
					.update(quoteOptions)
					.set({ quoteId: draftQuoteId })
					.where(eq(quoteOptions.id, optionId)),
			).rejects.toThrow();
			await expect(
				db
					.update(quoteLineItems)
					.set({ quoteOptionId: draftOptionId })
					.where(eq(quoteLineItems.quoteOptionId, optionId)),
			).rejects.toThrow();
		} finally {
			await db
				.update(quotes)
				.set({ status: "draft" })
				.where(eq(quotes.id, sentQuoteId));
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			if (originalDatabaseUrl === undefined) {
				delete process.env.DATABASE_URL;
			} else {
				process.env.DATABASE_URL = originalDatabaseUrl;
			}
		}
	});
});
