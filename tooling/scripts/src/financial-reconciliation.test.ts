import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	classifyMismatch,
	isCalendarDate,
	MISMATCH_TYPES,
	runIsolatedSafeFixes,
	sortMismatches,
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
			"multiple_receipts_per_payment",
			"multiple_invoices_per_schedule",
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
			"multiple_receipts_per_payment",
			"multiple_invoices_per_schedule",
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
		const draftAmountOnly = classifyMismatch({
			...base,
			entityType: "invoice",
			mismatchType: "invoice_paid_status_vs_valid_applications",
			actualStatus: "draft",
			expectedStatus: "draft",
		});

		assert.equal(cancelled.safeFixAvailable, false);
		assert.equal(draft.safeFixAvailable, false);
		assert.equal(draftAmountOnly.safeFixAvailable, false);
		assert.equal(draftAmountOnly.intendedAction, null);
	});

	it("does not auto-fix schedule or invoice aggregates with invalid parents", () => {
		for (const mismatchType of [
			"schedule_total_vs_assigned_active_payments",
			"invoice_paid_status_vs_valid_applications",
		] as const) {
			const mismatch = classifyMismatch({
				...base,
				entityType:
					mismatchType === "invoice_paid_status_vs_valid_applications"
						? "invoice"
						: "payment_schedule",
				mismatchType,
				parentLinksValid: false,
			});

			assert.equal(mismatch.safeFixAvailable, false);
			assert.equal(mismatch.intendedAction, null);
		}
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

	it("does not auto-fix booking, schedule, or invoice overpayments", () => {
		for (const mismatchType of [
			"booking_total_vs_active_payments",
			"schedule_total_vs_assigned_active_payments",
			"invoice_paid_status_vs_valid_applications",
		] as const) {
			const overpayment = classifyMismatch({
				...base,
				mismatchType,
				exceedsUpperBound: true,
			});
			assert.equal(overpayment.safeFixAvailable, false);
			assert.equal(overpayment.intendedAction, null);
		}
	});

	it("isolates failed safe repairs and preserves deterministic results", async () => {
		const mismatches = ["booking-1", "booking-2", "booking-3"].map(
			(entityId) =>
				classifyMismatch({
					...base,
					entityId,
					mismatchType: "booking_total_vs_active_payments",
				}),
		);
		const attempted: string[] = [];

		const result = await runIsolatedSafeFixes(
			mismatches,
			async (mismatch) => {
				attempted.push(mismatch.entityId);
				if (mismatch.entityId === "booking-2") {
					throw new Error("simulated transaction failure");
				}
				return true;
			},
		);

		assert.deepEqual(attempted, ["booking-1", "booking-2", "booking-3"]);
		assert.deepEqual(result.applied, [mismatches[0].id, mismatches[2].id]);
		assert.deepEqual(result.failed, [
			{
				mismatchId: mismatches[1].id,
				reason: "repair_transaction_failed",
			},
		]);
	});

	it("uses relation discriminators for collision-free deterministic ordering", () => {
		const paymentRelation = classifyMismatch({
			...base,
			mismatchType: "cross_entity_booking_org_disagreement",
			relationKey: "receipt.payment",
			relatedId: "same-id",
		});
		const invoiceRelation = classifyMismatch({
			...base,
			mismatchType: "cross_entity_booking_org_disagreement",
			relationKey: "receipt.invoice",
			relatedId: "same-id",
		});

		assert.notEqual(paymentRelation.id, invoiceRelation.id);
		const sorted = sortMismatches([paymentRelation, invoiceRelation]);
		assert.deepEqual(
			sorted.map((mismatch) => mismatch.relationKey),
			["receipt.invoice", "receipt.payment"],
		);
		assert.deepEqual(
			sortMismatches([invoiceRelation, paymentRelation]).map(
				(mismatch) => mismatch.id,
			),
			sorted.map((mismatch) => mismatch.id),
		);
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
