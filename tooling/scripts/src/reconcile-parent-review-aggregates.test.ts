import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseParentReviewReconciliationArguments } from "./parent-review-reconciliation-command";

describe("parent review reconciliation arguments", () => {
	it("parses report mode", () => {
		assert.deepEqual(
			parseParentReviewReconciliationArguments([
				"--report",
				"--organization-id",
				"org-1",
			]),
			{ mode: "report", organizationId: "org-1" },
		);
	});

	it("requires an exact reviewed hash and actor for repair", () => {
		const hash = "a".repeat(64);
		assert.deepEqual(
			parseParentReviewReconciliationArguments([
				"--repair-reviewed",
				"--organization-id",
				"org-1",
				"--reviewed-report-hash",
				hash,
				"--reviewed-by-user-id",
				"admin-1",
			]),
			{
				mode: "repair-reviewed",
				organizationId: "org-1",
				reviewedReportHash: hash,
				reviewedByUserId: "admin-1",
			},
		);
	});

	it("rejects unreviewed or ambiguous repair requests", () => {
		assert.throws(
			() =>
				parseParentReviewReconciliationArguments([
					"--repair-reviewed",
					"--organization-id",
					"org-1",
				]),
			/64-character hash/,
		);
		assert.throws(
			() =>
				parseParentReviewReconciliationArguments([
					"--report",
					"--repair-reviewed",
					"--organization-id",
					"org-1",
				]),
			/exactly one mode/,
		);
	});
});
