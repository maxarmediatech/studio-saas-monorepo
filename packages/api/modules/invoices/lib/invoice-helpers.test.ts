import { describe, expect, it } from "vitest";
import {
	getInvalidTransitionMessage,
	type InvoiceStatus,
	isValidStatusTransition,
} from "./status-transitions";

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
