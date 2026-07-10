import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	classifyMismatch,
	isCalendarDate,
	MISMATCH_TYPES,
	validateDecisionRecord,
} from "./financial-reconciliation";
import {
	parseReconciliationArguments,
	resultRows,
} from "./financial-reconciliation-command";

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

	it("does not auto-fix an invoice application without one valid receipt", () => {
		const missingReceipt = classifyMismatch({
			...base,
			entityType: "invoice",
			mismatchType: "invoice_paid_status_vs_valid_applications",
			actualStatus: "paid",
			expectedStatus: "sent",
			invalidLinkCount: 1,
		});

		assert.equal(missingReceipt.safeFixAvailable, false);
		assert.equal(missingReceipt.intendedAction, null);
	});
});

describe("database result normalization", () => {
	it("reads rows from the node-postgres query result wrapper", () => {
		const rows = [{ entityId: "booking-1" }];
		assert.equal(resultRows({ rows, rowCount: 1 }), rows);
	});

	it("rejects the old direct-array assumption", () => {
		assert.throws(
			() => resultRows([{ entityId: "booking-1" }]),
			/unexpected result shape/,
		);
	});
});

describe("reconciliation command arguments", () => {
	it("requires explicit values instead of consuming the next flag", () => {
		assert.throws(
			() =>
				parseReconciliationArguments(["--organization-id", "--report"]),
			/--organization-id requires a value/,
		);
		assert.throws(
			() =>
				parseReconciliationArguments([
					"--organization-id",
					"org-1",
					"--report",
					"--as-of",
				]),
			/--as-of requires a value/,
		);
	});

	it("accepts real dates and rejects impossible calendar dates", () => {
		assert.equal(isCalendarDate("2028-02-29"), true);
		assert.equal(isCalendarDate("2026-02-29"), false);
		assert.equal(isCalendarDate("2026-13-01"), false);
		assert.throws(
			() =>
				parseReconciliationArguments([
					"--organization-id",
					"org-1",
					"--report",
					"--as-of",
					"2026-02-30",
				]),
			/real calendar date/,
		);

		assert.deepEqual(
			parseReconciliationArguments([
				"--organization-id",
				"org-1",
				"--fix-safe",
				"--as-of",
				"2028-02-29",
			]),
			{
				mode: "fix-safe",
				organizationId: "org-1",
				asOf: "2028-02-29",
			},
		);
	});
});

describe("approved decision records", () => {
	it("requires all decision fields", () => {
		const result = validateDecisionRecord({ decisionDate: "2026-07-10" });
		assert.equal(result.valid, false);
		if (!result.valid) {
			assert.ok(
				result.errors.includes("decider must be a non-empty string"),
			);
		}
	});

	it("rejects an impossible decision date", () => {
		const result = validateDecisionRecord({
			decisionDate: "2026-02-30",
			decider: "Finance owner",
			evidence: ["report.json"],
			options: ["Review"],
			rationale: "Needs review.",
			consequences: ["No automatic repair."],
			revisitCondition: "After review.",
			mismatchIds: ["mismatch-1"],
			intendedAction: "manual_review",
		});
		assert.equal(result.valid, false);
		if (!result.valid) {
			assert.ok(
				result.errors.some((error) =>
					error.includes("real calendar date"),
				),
			);
		}
	});

	it("accepts the documented decision shape", () => {
		const result = validateDecisionRecord({
			decisionDate: "2026-07-10",
			decider: "Finance owner",
			evidence: [
				"report.json#booking_total_vs_active_payments:org-1:booking:booking-1",
			],
			options: [
				"Recalculate cached total",
				"Reverse and replace payment",
			],
			rationale: "The active payment links are valid.",
			consequences: ["Booking total changes to 90.00."],
			revisitCondition: "Revisit after ledger migration.",
			mismatchIds: [
				"booking_total_vs_active_payments:org-1:booking:booking-1",
			],
			intendedAction: "recalculate_booking_total",
		});

		assert.equal(result.valid, true);
	});
});
