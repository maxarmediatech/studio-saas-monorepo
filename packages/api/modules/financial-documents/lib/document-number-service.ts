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

interface DocumentSequenceInput {
	organizationId: string;
	documentType: DocumentType;
	baseNumber: string;
}

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
	input: DocumentSequenceInput,
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

export function isDocumentNumberUniqueConflict(
	error: unknown,
	constraintName: string,
): boolean {
	let current: unknown = error;
	let foundConstraintWithoutCode = false;
	let foundUniqueViolation = false;
	let foundOtherPostgresCode = false;

	for (let depth = 0; depth < 8 && current; depth += 1) {
		const candidate = current as {
			code?: string;
			constraint?: string;
			constraint_name?: string;
			message?: string;
			cause?: unknown;
		};
		const matchesConstraint =
			candidate.constraint === constraintName ||
			candidate.constraint_name === constraintName ||
			candidate.message
				?.toLowerCase()
				.includes(constraintName.toLowerCase());

		if (candidate.code === "23505") {
			foundUniqueViolation = true;
		} else if (candidate.code) {
			foundOtherPostgresCode = true;
		}

		if (matchesConstraint) {
			if (candidate.code === "23505") {
				return true;
			}
			if (!candidate.code) {
				foundConstraintWithoutCode = true;
			}
		}
		current = candidate.cause;
	}

	return (
		foundConstraintWithoutCode &&
		(foundUniqueViolation || !foundOtherPostgresCode)
	);
}

export async function retryDocumentNumberInsert<T>(input: {
	attempt: () => Promise<T>;
	repairSequenceFloor: () => Promise<unknown>;
	constraintName: string;
	maxAttempts?: number;
}): Promise<T> {
	const maxAttempts = input.maxAttempts ?? 5;
	if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
		throw new Error(
			"Document number insert attempts must be a positive integer",
		);
	}

	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		try {
			return await input.attempt();
		} catch (error) {
			if (
				!isDocumentNumberUniqueConflict(error, input.constraintName) ||
				attempt === maxAttempts - 1
			) {
				throw error;
			}
			await input.repairSequenceFloor();
		}
	}

	throw new Error("Document number insert retry limit exhausted");
}

export async function advanceDocumentSequenceFloor(
	tx: TransactionClient,
	input: DocumentSequenceInput,
): Promise<number> {
	const observedNextValue = await getInitialValue(tx, input);

	// Invoice and receipt sequences start at zero, which cannot be represented by
	// the positive next_value constraint. With no history there is no floor to fix.
	if (observedNextValue === 0) {
		return observedNextValue;
	}

	const now = new Date();
	const [sequence] = await tx
		.insert(documentSequences)
		.values({
			organizationId: input.organizationId,
			documentType: input.documentType,
			scopeKey: input.baseNumber,
			nextValue: observedNextValue,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [
				documentSequences.organizationId,
				documentSequences.documentType,
				documentSequences.scopeKey,
			],
			set: {
				nextValue: sql`greatest(${documentSequences.nextValue}, ${observedNextValue})`,
				updatedAt: now,
			},
		})
		.returning({ nextValue: documentSequences.nextValue });

	if (!sequence) {
		throw new Error("Failed to advance document sequence floor");
	}
	return sequence.nextValue;
}

export async function allocateDocumentSequenceValue(
	tx: TransactionClient,
	input: DocumentSequenceInput,
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
				nextValue: sql`greatest(${documentSequences.nextValue}, ${initialValue}) + 1`,
				updatedAt: now,
			},
		})
		.returning({ nextValue: documentSequences.nextValue });

	if (!sequence) {
		throw new Error("Failed to allocate financial document number");
	}
	return sequence.nextValue - 1;
}

export async function allocateDocumentNumber(
	tx: TransactionClient,
	input: DocumentSequenceInput,
): Promise<string> {
	const allocatedValue = await allocateDocumentSequenceValue(tx, input);
	return allocatedValue === 0
		? input.baseNumber
		: `${input.baseNumber}-${allocatedValue}`;
}
