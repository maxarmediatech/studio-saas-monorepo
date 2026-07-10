import { createHash } from "node:crypto";
import { centsToMoney, moneyToCents } from "../../studio/lib/money";
import type {
	ConvertScheduleInput,
	CreateReceivedInput,
} from "../../studio/schemas/payment";

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(canonicalize);
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, child]) => [key, canonicalize(child)]),
		);
	}
	return value;
}

export function canonicalJson(value: unknown): string {
	return JSON.stringify(canonicalize(value));
}

function fingerprint(value: unknown): string {
	return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function normalizeMoney(value: string): string {
	return centsToMoney(moneyToCents(value));
}

export function createReceivedPaymentFingerprint(
	input: CreateReceivedInput,
): string {
	const attachment = input.proofAttachment
		? {
				key: input.proofAttachment.key,
				name: input.proofAttachment.name,
				size: input.proofAttachment.size,
				type: input.proofAttachment.type,
				url: input.proofAttachment.url,
			}
		: null;

	return fingerprint({
		amount: normalizeMoney(input.amount),
		bookingId: input.bookingId,
		invoiceId: input.invoiceId ?? null,
		notes: input.notes ?? null,
		paymentMethod: input.paymentMethod,
		paymentScheduleId: input.paymentScheduleId ?? null,
		proofAttachment: attachment,
		receivedDate: input.receivedDate,
		transactionReference: input.transactionReference ?? null,
	});
}

export function convertSchedulePaymentFingerprint(
	input: ConvertScheduleInput,
): string {
	return fingerprint({
		amount: normalizeMoney(input.amount),
		notes: input.notes ?? null,
		paymentMethod: input.paymentMethod,
		receivedDate: input.receivedDate,
		scheduleId: input.scheduleId,
		transactionReference: input.transactionReference ?? null,
	});
}
