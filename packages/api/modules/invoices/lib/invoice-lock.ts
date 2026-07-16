import { and, type db, eq, invoices, isNull, sql } from "@repo/database";

type InvoiceLockTransaction = Pick<typeof db, "execute" | "query">;

export async function getLockedInvoice(
	tx: InvoiceLockTransaction,
	input: { organizationId: string; invoiceId: string },
) {
	await tx.execute(sql`
		SELECT ${invoices.id}
		FROM ${invoices}
		WHERE ${invoices.id} = ${input.invoiceId}
			AND ${invoices.organizationId} = ${input.organizationId}
			AND ${invoices.deletedAt} IS NULL
		FOR UPDATE
	`);

	return tx.query.invoices.findFirst({
		where: and(
			eq(invoices.id, input.invoiceId),
			eq(invoices.organizationId, input.organizationId),
			isNull(invoices.deletedAt),
		),
	});
}
