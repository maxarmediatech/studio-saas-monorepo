import {
	and,
	documentSequences,
	eq,
	invoices,
	receipts,
	sql,
} from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";

type DocumentType = "invoice" | "receipt";

function getAllocatedValue(baseNumber: string, documentNumber: string): number {
	if (documentNumber === baseNumber) {
		return 0;
	}
	if (!documentNumber.startsWith(`${baseNumber}-`)) {
		return -1;
	}

	const suffix = documentNumber.slice(baseNumber.length + 1);
	return /^\d+$/.test(suffix) ? Number.parseInt(suffix, 10) : -1;
}

async function getInitialValue(
	tx: TransactionClient,
	input: {
		organizationId: string;
		documentType: DocumentType;
		baseNumber: string;
	},
): Promise<number> {
	const rows =
		input.documentType === "invoice"
			? await tx
					.select({ documentNumber: invoices.invoiceNumber })
					.from(invoices)
					.where(
						and(
							eq(invoices.organizationId, input.organizationId),
							sql`${invoices.invoiceNumber} LIKE ${`${input.baseNumber}%`}`,
						),
					)
			: await tx
					.select({ documentNumber: receipts.receiptNumber })
					.from(receipts)
					.where(
						and(
							eq(receipts.organizationId, input.organizationId),
							sql`${receipts.receiptNumber} LIKE ${`${input.baseNumber}%`}`,
						),
					);

	return (
		rows.reduce(
			(maximum, row) =>
				Math.max(
					maximum,
					getAllocatedValue(input.baseNumber, row.documentNumber),
				),
			-1,
		) + 1
	);
}

export async function allocateDocumentNumber(
	tx: TransactionClient,
	input: {
		organizationId: string;
		documentType: DocumentType;
		baseNumber: string;
	},
): Promise<string> {
	const initialValue = await getInitialValue(tx, input);
	const now = new Date();
	const [sequence] = await tx
		.insert(documentSequences)
		.values({
			organizationId: input.organizationId,
			documentType: input.documentType,
			scopeKey: input.baseNumber,
			nextValue: initialValue + 1,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [
				documentSequences.organizationId,
				documentSequences.documentType,
				documentSequences.scopeKey,
			],
			set: {
				nextValue: sql`${documentSequences.nextValue} + 1`,
				updatedAt: now,
			},
		})
		.returning({ nextValue: documentSequences.nextValue });

	if (!sequence) {
		throw new Error("Failed to allocate financial document number");
	}

	const allocatedValue = sequence.nextValue - 1;
	return allocatedValue === 0
		? input.baseNumber
		: `${input.baseNumber}-${allocatedValue}`;
}
