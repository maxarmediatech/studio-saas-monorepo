import { describe, expect, it } from "vitest";
import { getNextInvoiceNumber } from "./invoice-number-utils";
import {
	getInvalidTransitionMessage,
	type InvoiceStatus,
	isValidStatusTransition,
} from "./status-transitions";

describe("getNextInvoiceNumber", () => {
	it("returns base when there is no existing invoice", () => {
		const result = getNextInvoiceNumber("INV-RS-2602-0001-260211", null);
		expect(result).toBe("INV-RS-2602-0001-260211");
	});

	it("adds -1 when existing equals base", () => {
		const result = getNextInvoiceNumber(
			"INV-RS-2602-0001-260211",
			"INV-RS-2602-0001-260211",
		);
		expect(result).toBe("INV-RS-2602-0001-260211-1");
	});

	it("increments explicit numeric suffix", () => {
		const result = getNextInvoiceNumber(
			"INV-RS-2602-0001-260211",
			"INV-RS-2602-0001-260211-9",
		);
		expect(result).toBe("INV-RS-2602-0001-260211-10");
	});

	it("falls back to -1 for non-matching suffix", () => {
		const result = getNextInvoiceNumber(
			"INV-RS-2602-0001-260211",
			"INV-RS-2602-0001-260211-ABC",
		);
		expect(result).toBe("INV-RS-2602-0001-260211-1");
	});

	it("handles base numbers containing regex special characters", () => {
		const result = getNextInvoiceNumber(
			"INV-BK.(A)+?-260211",
			"INV-BK.(A)+?-260211-1",
		);
		expect(result).toBe("INV-BK.(A)+?-260211-2");
	});
});

describe("isValidStatusTransition", () => {
	const validTransitions: Array<[InvoiceStatus, InvoiceStatus]> = [
		["draft", "sent"],
		["draft", "cancelled"],
		["sent", "paid"],
		["sent", "partial"],
		["sent", "overdue"],
		["sent", "cancelled"],
		["partial", "paid"],
		["partial", "overdue"],
		["partial", "cancelled"],
		["paid", "cancelled"],
		["overdue", "paid"],
		["overdue", "partial"],
		["overdue", "cancelled"],
	];

	it.each(validTransitions)("allows transition from %s to %s", (from, to) => {
		expect(isValidStatusTransition(from, to)).toBe(true);
	});

	const invalidTransitions: Array<[InvoiceStatus, InvoiceStatus]> = [
		["draft", "paid"],
		["draft", "partial"],
		["draft", "overdue"],
		["sent", "draft"],
		["paid", "draft"],
		["paid", "sent"],
		["paid", "partial"],
		["paid", "overdue"],
		["cancelled", "draft"],
		["cancelled", "sent"],
		["cancelled", "paid"],
		["cancelled", "partial"],
		["cancelled", "overdue"],
	];

	it.each(
		invalidTransitions,
	)("blocks transition from %s to %s", (from, to) => {
		expect(isValidStatusTransition(from, to)).toBe(false);
	});

	it("allows same status (no-op)", () => {
		const statuses: InvoiceStatus[] = [
			"draft",
			"sent",
			"paid",
			"partial",
			"overdue",
			"cancelled",
		];
		for (const status of statuses) {
			expect(isValidStatusTransition(status, status)).toBe(true);
		}
	});
});

describe("getInvalidTransitionMessage", () => {
	it("provides message for cancelled invoice", () => {
		const message = getInvalidTransitionMessage("cancelled", "sent");
		expect(message).toContain("cancelled invoice");
	});

	it("provides message for paid invoice", () => {
		const message = getInvalidTransitionMessage("paid", "sent");
		expect(message).toContain("Paid invoices");
	});

	it("provides message for draft to paid", () => {
		const message = getInvalidTransitionMessage("draft", "paid");
		expect(message).toContain("draft");
		expect(message).toContain("sent first");
	});

	it("provides generic message for other invalid transitions", () => {
		const message = getInvalidTransitionMessage("sent", "draft");
		expect(message).toContain("Cannot transition");
		expect(message).toContain("sent");
		expect(message).toContain("draft");
	});
});
