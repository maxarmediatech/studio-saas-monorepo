import { describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("serialized invoice mutations", () => {
	it("protects the last line item and serializes finalization against edits", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;
		const {
			bookings,
			count,
			db,
			eq,
			invoiceLineItems,
			invoices,
			organizations,
		} = await import("@repo/database");
		const { getLockedInvoice } = await import("./invoice-lock");
		const { recalculateInvoiceTotals } = await import("./invoice-helpers");
		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `invoice_mutation_org_${suffix}`;
		const bookingId = `invoice_mutation_booking_${suffix}`;
		const invoiceId = `invoice_mutation_invoice_${suffix}`;
		const itemIds = [
			`invoice_mutation_item_a_${suffix}`,
			`invoice_mutation_item_b_${suffix}`,
		];

		try {
			await db.insert(organizations).values({
				id: organizationId,
				name: "Invoice mutation test",
				slug: `invoice-mutation-${suffix}`,
			});
			await db.insert(bookings).values({
				id: bookingId,
				organizationId,
				referenceNumber: `INV-MUT-${suffix}`,
				name: "Invoice mutation booking",
				bookingType: "test",
				packageType: "test",
				packageCost: "200.00",
			});
			await db.insert(invoices).values({
				id: invoiceId,
				organizationId,
				bookingId,
				invoiceNumber: `INV-MUT-${suffix}`,
				issueDate: "2026-01-01",
				subtotal: "200.00",
				taxType: "no_gst",
				totalAmount: "200.00",
			});
			await db.insert(invoiceLineItems).values(
				itemIds.map((id, sortOrder) => ({
					id,
					invoiceId,
					type: "item" as const,
					description: `Item ${sortOrder + 1}`,
					quantity: "1.00",
					unitPrice: "100.00",
					amount: "100.00",
					sortOrder,
				})),
			);

			const removeIfAllowed = (lineItemId: string) =>
				db.transaction(async (tx) => {
					const invoice = await getLockedInvoice(tx, {
						organizationId,
						invoiceId,
					});
					if (invoice?.status !== "draft") {
						return "not-draft";
					}
					const [row] = await tx
						.select({ count: count().mapWith(Number) })
						.from(invoiceLineItems)
						.where(eq(invoiceLineItems.invoiceId, invoiceId));
					if ((row?.count ?? 0) <= 1) {
						return "last-item";
					}
					await tx
						.delete(invoiceLineItems)
						.where(eq(invoiceLineItems.id, lineItemId));
					const totals = await recalculateInvoiceTotals(
						tx,
						invoiceId,
					);
					await tx
						.update(invoices)
						.set(totals)
						.where(eq(invoices.id, invoiceId));
					return "removed";
				});

			const removals = await Promise.all(itemIds.map(removeIfAllowed));
			expect(removals.sort()).toEqual(["last-item", "removed"]);
			const remainingItems = await db.query.invoiceLineItems.findMany({
				where: eq(invoiceLineItems.invoiceId, invoiceId),
			});
			expect(remainingItems).toHaveLength(1);
			const afterRemoval = await db.query.invoices.findFirst({
				where: eq(invoices.id, invoiceId),
			});
			expect(afterRemoval).toMatchObject({
				subtotal: "100.00",
				totalAmount: "100.00",
			});

			const addIfDraft = () =>
				db.transaction(async (tx) => {
					const invoice = await getLockedInvoice(tx, {
						organizationId,
						invoiceId,
					});
					if (invoice?.status !== "draft") {
						return "not-draft";
					}
					await tx.insert(invoiceLineItems).values({
						invoiceId,
						type: "item",
						description: "Racing item",
						quantity: "1.00",
						unitPrice: "50.00",
						amount: "50.00",
						sortOrder: 1,
					});
					const totals = await recalculateInvoiceTotals(
						tx,
						invoiceId,
					);
					await tx
						.update(invoices)
						.set(totals)
						.where(eq(invoices.id, invoiceId));
					return "added";
				});
			const finalize = () =>
				db.transaction(async (tx) => {
					const invoice = await getLockedInvoice(tx, {
						organizationId,
						invoiceId,
					});
					if (invoice?.status !== "draft") {
						return "already-final";
					}
					await tx
						.update(invoices)
						.set({ status: "sent", sentAt: new Date() })
						.where(eq(invoices.id, invoiceId));
					return "sent";
				});

			const [addResult, finalizeResult] = await Promise.all([
				addIfDraft(),
				finalize(),
			]);
			expect(finalizeResult).toBe("sent");
			expect(["added", "not-draft"]).toContain(addResult);
			const finalized = await db.query.invoices.findFirst({
				where: eq(invoices.id, invoiceId),
			});
			expect(finalized?.status).toBe("sent");
			expect(finalized?.totalAmount).toBe(
				addResult === "added" ? "150.00" : "100.00",
			);
			expect(await addIfDraft()).toBe("not-draft");
		} finally {
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
	}, 15_000);
});
