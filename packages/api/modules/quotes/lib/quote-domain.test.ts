import { describe, expect, it } from "vitest";
import { canRunQuoteCommand, isQuoteExpiryDue } from "./quote-lifecycle";
import {
	findInvalidParticipantClients,
	normalizeQuoteContent,
} from "./quote-normalization";
import { getQuoteNumberPrefix } from "./quote-number-format";

const CLIENT_A = "00000000-0000-4000-8000-000000000001";
const CLIENT_B = "00000000-0000-4000-8000-000000000002";
const blueprint = {
	schemaVersion: 1 as const,
	booking: {
		name: "Wedding",
		bookingDate: "2026-10-01",
		bookingType: "wedding",
		packageType: "premium",
	},
};

function content() {
	return {
		title: "Wedding quote",
		currency: "INR",
		participants: [
			{ clientId: CLIENT_A, role: "bride", isPrimary: true },
			{ clientId: CLIENT_B, role: "groom", isPrimary: false },
		],
		options: [
			{
				name: "Premium",
				discountAmount: "0.01",
				taxAmount: "0.02",
				bookingBlueprint: blueprint,
				isRecommended: true,
				lineItems: [
					{
						type: "service" as const,
						description: "Coverage",
						quantity: "1.25",
						unitPrice: "10.01",
					},
					{
						type: "expense" as const,
						description: "Permit",
						amount: "2.00",
					},
				],
			},
		],
	};
}

function contentWithSchedules(
	schedules: Array<{
		name: string;
		amount: string;
		dueDate: string;
		sortOrder?: number;
	}>,
) {
	const input = content();
	const option = input.options[0];
	if (!option) {
		throw new Error("Missing option fixture");
	}
	if (option.bookingBlueprint.schemaVersion !== 1) {
		throw new Error("Expected blueprint v1 fixture");
	}
	return {
		...input,
		options: [
			{
				...option,
				bookingBlueprint: {
					...option.bookingBlueprint,
					booking: {
						...option.bookingBlueprint.booking,
						paymentSchedules: schedules,
					},
				},
			},
		],
	};
}

describe("quote domain normalization", () => {
	it("derives stable array ordering and decimal-safe half-up totals", () => {
		const normalized = normalizeQuoteContent(content());
		expect(normalized.participants.map((item) => item.sortOrder)).toEqual([
			0, 1,
		]);
		expect(normalized.options[0]?.sortOrder).toBe(0);
		expect(
			normalized.options[0]?.lineItems.map((item) => item.sortOrder),
		).toEqual([0, 1]);
		expect(normalized.options[0]?.lineItems[0]?.amount).toBe("12.51");
		expect(normalized.options[0]?.subtotal).toBe("14.51");
		expect(normalized.options[0]?.totalAmount).toBe("14.52");
	});

	it("rejects discount above the server-computed subtotal", () => {
		const input = content();
		const option = input.options[0];
		if (!option) {
			throw new Error("Missing option fixture");
		}
		option.discountAmount = "999.00";
		expect(() => normalizeQuoteContent(input)).toThrow(
			"Discount cannot exceed subtotal",
		);
	});

	it("derives payment schedule order and accepts an exact aggregate", () => {
		const normalized = normalizeQuoteContent(
			contentWithSchedules([
				{
					name: "Deposit",
					amount: "7.00",
					dueDate: "2026-08-01",
					sortOrder: 99,
				},
				{
					name: "Balance",
					amount: "7.52",
					dueDate: "2026-09-01",
					sortOrder: 99,
				},
			]),
		);
		const blueprint = normalized.options[0]?.bookingBlueprint;
		if (blueprint?.schemaVersion !== 1) {
			throw new Error("Expected normalized blueprint v1");
		}
		expect(blueprint.booking.paymentSchedules).toEqual([
			expect.objectContaining({ amount: "7.00", sortOrder: 0 }),
			expect.objectContaining({ amount: "7.52", sortOrder: 1 }),
		]);
	});

	it("rejects payment schedule mismatch and over-total aggregates", () => {
		for (const amount of ["14.51", "15.00"]) {
			expect(() =>
				normalizeQuoteContent(
					contentWithSchedules([
						{
							name: "Payment",
							amount,
							dueDate: "2026-08-01",
						},
					]),
				),
			).toThrow("Payment schedules must equal the quote option total");
		}
	});

	it("rejects payment schedule aggregate numeric overflow", () => {
		expect(() =>
			normalizeQuoteContent(
				contentWithSchedules([
					{
						name: "First",
						amount: "5000000000.00",
						dueDate: "2026-08-01",
					},
					{
						name: "Second",
						amount: "5000000000.00",
						dueDate: "2026-09-01",
					},
				]),
			),
		).toThrow("Payment schedule aggregate exceeds 9999999999.99");
	});

	it("identifies missing, deleted, or cross-tenant participant clients", () => {
		expect(
			findInvalidParticipantClients(content().participants, [CLIENT_A]),
		).toEqual([CLIENT_B]);
	});
});

describe("quote number timezone", () => {
	it("uses the organization month at an UTC month boundary", () => {
		const instant = new Date("2026-04-30T19:00:00.000Z");
		expect(
			getQuoteNumberPrefix("Studio One", "Asia/Kolkata", instant),
		).toBe("SO-Q-2605");
		expect(
			getQuoteNumberPrefix("Studio One", "America/New_York", instant),
		).toBe("SO-Q-2604");
	});
});

describe("quote lifecycle guards", () => {
	it("keeps content editing draft-only and conversion accepted/idempotent-only", () => {
		expect(canRunQuoteCommand("draft", "edit")).toBe(true);
		expect(canRunQuoteCommand("sent", "edit")).toBe(false);
		expect(canRunQuoteCommand("accepted", "revise")).toBe(true);
		expect(canRunQuoteCommand("converted", "revise")).toBe(false);
		expect(canRunQuoteCommand("accepted", "convert")).toBe(true);
		expect(canRunQuoteCommand("converted", "convert")).toBe(true);
	});

	it("allows expiry only when a configured expiry is due", () => {
		const now = new Date("2026-10-01T00:00:00.000Z");
		expect(isQuoteExpiryDue(null, now)).toBe(false);
		expect(
			isQuoteExpiryDue(new Date("2026-10-01T00:00:00.000Z"), now),
		).toBe(true);
		expect(
			isQuoteExpiryDue(new Date("2026-10-02T00:00:00.000Z"), now),
		).toBe(false);
	});
});
