import { describe, expect, it } from "vitest";
import type {
	ConvertScheduleInput,
	CreateReceivedInput,
} from "../../studio/schemas/payment";
import {
	convertScheduleInputSchema,
	paymentIdempotencyKeySchema,
} from "../../studio/schemas/payment";
import {
	canonicalJson,
	convertSchedulePaymentFingerprint,
	createReceivedPaymentFingerprint,
} from "./payment-request-fingerprint";

const createInput: CreateReceivedInput = {
	idempotencyKey: "018f47c6-9aba-7a16-b6d8-c6e280000001",
	bookingId: "018f47c6-9aba-7a16-b6d8-c6e280000002",
	amount: "100.00",
	paymentMethod: "bank_transfer",
	receivedDate: "2026-07-10",
};

describe("payment request fingerprints", () => {
	it("accepts bounded UUID-compatible keys and requires an effective conversion date", () => {
		expect(
			paymentIdempotencyKeySchema.safeParse(
				"018f47c6-9aba-7a16-b6d8-c6e280000003",
			).success,
		).toBe(true);
		expect(paymentIdempotencyKeySchema.safeParse("too-short").success).toBe(
			false,
		);
		expect(
			paymentIdempotencyKeySchema.safeParse("x".repeat(129)).success,
		).toBe(false);
		expect(
			paymentIdempotencyKeySchema.safeParse("invalid/key/token").success,
		).toBe(false);
		expect(
			convertScheduleInputSchema.safeParse({
				idempotencyKey: "018f47c6-9aba-7a16-b6d8-c6e280000003",
				scheduleId: "018f47c6-9aba-7a16-b6d8-c6e280000004",
				amount: "100.00",
				paymentMethod: "cash",
			}).success,
		).toBe(false);
	});

	it("canonicalizes object properties independently of insertion order", () => {
		expect(canonicalJson({ z: 1, nested: { b: 2, a: 1 }, a: 2 })).toBe(
			canonicalJson({ a: 2, nested: { a: 1, b: 2 }, z: 1 }),
		);
	});

	it("normalizes money and absent optional fields and excludes the key", () => {
		const equivalent: CreateReceivedInput = {
			...createInput,
			idempotencyKey: "018f47c6-9aba-7a16-b6d8-c6e280000099",
			amount: "100",
			invoiceId: undefined,
			notes: undefined,
		};

		expect(createReceivedPaymentFingerprint(equivalent)).toBe(
			createReceivedPaymentFingerprint(createInput),
		);
	});

	it("includes the selected invoice in the idempotency fingerprint", () => {
		expect(
			createReceivedPaymentFingerprint({
				...createInput,
				invoiceId: "018f47c6-9aba-7a16-b6d8-c6e280000005",
			}),
		).not.toBe(createReceivedPaymentFingerprint(createInput));
	});

	it("includes every conversion field that can change payment effects", () => {
		const input: ConvertScheduleInput = {
			idempotencyKey: "018f47c6-9aba-7a16-b6d8-c6e280000003",
			scheduleId: "018f47c6-9aba-7a16-b6d8-c6e280000004",
			amount: "100.00",
			paymentMethod: "cash",
			receivedDate: "2026-07-10",
		};
		const base = convertSchedulePaymentFingerprint(input);

		expect(
			convertSchedulePaymentFingerprint({
				...input,
				receivedDate: "2026-07-11",
			}),
		).not.toBe(base);
		expect(
			convertSchedulePaymentFingerprint({
				...input,
				transactionReference: "bank-ref",
			}),
		).not.toBe(base);
	});
});
