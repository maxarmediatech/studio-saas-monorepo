import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	MISMATCH_TYPES,
	classifyMismatch,
	validateDecisionRecord,
} from "./financial-reconciliation.ts";

const base = {
	organizationId: "org-1",
	entityType: "booking",
	entityId: "booking-1",
	actualValue: "100.00",
	expectedValue: "90.00",
} as const;

describe("financial reconciliation taxonomy", () => {
	it("contains exactly the eight Phase 0.3 mismatch classes", () => {
		assert.deepEqual(MISMATCH_TYPES, [
			"booking_total_vs_active_payments",
			"schedule_total_vs_assigned_active_payments",
			"invoice_paid_status_vs_valid_applications",
			"receipt_payment_amount_mismatch",
			"active_receipt_for_deleted_payment",
			"cross_entity_booking_org_disagreement",
			"duplicate_active_receipts_per_payment",
			"duplicate_invoices_per_schedule",
		]);
	});

	it("allows a booking total recalculation only with valid links", () => {
		const safe = classifyMismatch({
			...base,
			mismatchType: "booking_total_vs_active_payments",
		});
		const unsafe = classifyMismatch({
			...base,
			mismatchType: "booking_total_vs_active_payments",
			invalidLinkCount: 1,
		});

		assert.equal(safe.safeFixAvailable, true);
		assert.equal(safe.intendedAction, "recalculate_booking_total");
		assert.equal(unsafe.safeFixAvailable, false);
		assert.equal(unsafe.intendedAction, null);
	});

	it("never auto-fixes issued-document history", () => {
		for (const mismatchType of [
			"receipt_payment_amount_mismatch",
			"active_receipt_for_deleted_payment",
			"cross_entity_booking_org_disagreement",
			"duplicate_active_receipts_per_payment",
			"duplicate_invoices_per_schedule",
		] as const) {
			const result = classifyMismatch({ ...base, mismatchType });
			assert.equal(result.safeFixAvailable, false);
			assert.equal(result.intendedAction, null);
		}
	});

	it("does not auto-fix cancelled or ambiguous draft invoices", () => {
		const cancelled = classifyMismatch({
			...base,
			entityType: "invoice",
			mismatchType: "invoice_paid_status_vs_valid_applications",
			actualStatus: "cancelled",
			expectedStatus: "paid",
		});
		const draft = classifyMismatch({
			...base,
			entityType: "invoice",
			mismatchType: "invoice_paid_status_vs_valid_applications",
			actualStatus: "draft",
			expectedStatus: "partial",
		});

		assert.equal(cancelled.safeFixAvailable, false);
		assert.equal(draft.safeFixAvailable, false);
	});
});

describe("approved decision records", () => {
	it("requires all decision fields", () => {
		const result = validateDecisionRecord({ decisionDate: "2026-07-10" });
		assert.equal(result.valid, false);
		if (!result.valid) assert.ok(result.errors.includes("decider must be a non-empty string"));
	});

	it("accepts the documented decision shape", () => {
		const result = validateDecisionRecord({
			decisionDate: "2026-07-10",
			decider: "Finance owner",
			evidence: ["report.json#booking_total_vs_active_payments:org-1:booking:booking-1"],
			options: ["Recalculate cached total", "Reverse and replace payment"],
			rationale: "The active payment links are valid.",
			consequences: ["Booking total changes to 90.00."],
			revisitCondition: "Revisit after ledger migration.",
			mismatchIds: ["booking_total_vs_active_payments:org-1:booking:booking-1"],
			intendedAction: "recalculate_booking_total",
		});

		assert.equal(result.valid, true);
	});
});
