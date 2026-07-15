import { and, type db, eq, invoices, isNull } from "@repo/database";

type InvoiceUpdateExecutor = Pick<typeof db, "update">;

interface UnpaidInvoiceTransitionInput {
	organizationId: string;
	invoiceId: string;
	actorId: string;
}

export async function softDeleteUnpaidInvoice(
	executor: InvoiceUpdateExecutor,
	{ organizationId, invoiceId, actorId }: UnpaidInvoiceTransitionInput,
) {
	const now = new Date();
	const [deleted] = await executor
		.update(invoices)
		.set({
			deletedAt: now,
			deletedBy: actorId,
			updatedAt: now,
			updatedBy: actorId,
		})
		.where(
			and(
				eq(invoices.id, invoiceId),
				eq(invoices.organizationId, organizationId),
				isNull(invoices.deletedAt),
				eq(invoices.paidAmount, "0"),
			),
		)
		.returning();

	return deleted ?? null;
}

export async function cancelUnpaidInvoice(
	executor: InvoiceUpdateExecutor,
	{
		organizationId,
		invoiceId,
		actorId,
		expectedStatus,
		notes,
	}: UnpaidInvoiceTransitionInput & {
		expectedStatus: (typeof invoices.$inferSelect)["status"];
		notes?: string;
	},
) {
	const [cancelled] = await executor
		.update(invoices)
		.set({
			status: "cancelled",
			notes,
			updatedAt: new Date(),
			updatedBy: actorId,
		})
		.where(
			and(
				eq(invoices.id, invoiceId),
				eq(invoices.organizationId, organizationId),
				isNull(invoices.deletedAt),
				eq(invoices.paidAmount, "0"),
				eq(invoices.status, expectedStatus),
			),
		)
		.returning();

	return cancelled ?? null;
}
