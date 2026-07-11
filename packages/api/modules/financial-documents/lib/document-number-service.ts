import {
	and,
	bookings,
	documentSequences,
	eq,
	invoices,
	receipts,
	sql,
} from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";

type DocumentType = "booking" | "invoice" | "receipt";

function getAllocatedValue(
	documentType: DocumentType,
	baseNumber: string,
	documentNumber: string,
): number {
	if (documentType === "booking") {
		if (!documentNumber.startsWith(baseNumber)) {
			return -1;
		}
		const suffix = documentNumber.slice(baseNumber.length);
		return /^\d{4}$/.test(suffix) ? Number.parseInt(suffix, 10) : -1;
	}
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
		input.documentType === "booking"
			? await tx
					.select({ documentNumber: bookings.referenceNumber })
					.from(bookings)
					.where(
						and(
							eq(bookings.organizationId, input.organizationId),
							sql`${bookings.referenceNumber} LIKE ${`${input.baseNumber}%`}`,
						),
					)
			: input.documentType === "invoice"
				? await tx
						.select({ documentNumber: invoices.invoiceNumber })
						.from(invoices)
						.where(
							and(
								eq(
									invoices.organizationId,
									input.organizationId,
								),
								sql`${invoices.invoiceNumber} LIKE ${`${input.baseNumber}%`}`,
							),
						)
				: await tx
						.select({ documentNumber: receipts.receiptNumber })
						.from(receipts)
						.where(
							and(
								eq(
									receipts.organizationId,
									input.organizationId,
								),
								sql`${receipts.receiptNumber} LIKE ${`${input.baseNumber}%`}`,
							),
						);

	return (
		rows.reduce(
			(maximum, row) =>
				Math.max(
					maximum,
					getAllocatedValue(
						input.documentType,
						input.baseNumber,
						row.documentNumber,
					),
				),
			input.documentType === "booking" ? 0 : -1,
		) + 1
	);
}

export async function allocateDocumentSequenceValue(
	tx: TransactionClient,
	input: {
		organizationId: string;
		documentType: DocumentType;
		baseNumber: string;
	},
): Promise<number> {
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
		throw new Error("Failed to allocate document sequence value");
	}
	return sequence.nextValue - 1;
}

export async function allocateDocumentNumber(
	tx: TransactionClient,
	input: {
		organizationId: string;
		documentType: DocumentType;
		baseNumber: string;
	},
): Promise<string> {
	const allocatedValue = await allocateDocumentSequenceValue(tx, input);
	return allocatedValue === 0
		? input.baseNumber
		: `${input.baseNumber}-${allocatedValue}`;
}
