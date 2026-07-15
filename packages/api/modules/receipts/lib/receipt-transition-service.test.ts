import { describe, expect, it } from "vitest";
import { isReceiptNumberConflict } from "./receipt-transition-service";

describe("receipt number conflict classification", () => {
	it("retries only the receipt-number constraint", () => {
		expect(
			isReceiptNumberConflict({
				code: "23505",
				constraint: "receipts_org_number_idx",
			}),
		).toBe(true);
		expect(
			isReceiptNumberConflict({
				code: "23505",
				constraint: "receipts_active_received_amount_idx",
			}),
		).toBe(false);
	});

	it("finds the PostgreSQL constraint through wrapped errors", () => {
		expect(
			isReceiptNumberConflict({
				cause: {
					code: "23505",
					constraint: "receipts_org_number_idx",
				},
			}),
		).toBe(true);
	});

	it("rejects the right constraint when the PostgreSQL code is not unique", () => {
		expect(
			isReceiptNumberConflict({
				code: "23514",
				constraint: "receipts_org_number_idx",
			}),
		).toBe(false);
	});
});
