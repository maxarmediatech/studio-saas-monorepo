import assert from "node:assert/strict";
import test from "node:test";
import { MISMATCH_TYPES } from "./financial-reconciliation";
import type { FinancialReconciliationReport } from "./reconcile-financials";
import {
	buildFinancialMigrationPreflight,
	parseFinancialMigrationPreflightArguments,
} from "./financial-migration-preflight";

function report(
	organizationId: string,
	mismatchIds: string[],
): FinancialReconciliationReport {
	return {
		reportVersion: 1,
		organizationId,
		asOf: "2026-07-15",
		mismatchTypes: MISMATCH_TYPES,
		summary: {} as FinancialReconciliationReport["summary"],
		mismatches: mismatchIds.map(
			(id) =>
				({ id }) as FinancialReconciliationReport["mismatches"][number],
		),
	};
}

test("parses one optional deterministic as-of date", () => {
	assert.deepEqual(
		parseFinancialMigrationPreflightArguments([], new Date("2026-07-15")),
		{ asOf: "2026-07-15" },
	);
	assert.deepEqual(
		parseFinancialMigrationPreflightArguments([
			"--as-of",
			"2026-07-14",
		]),
		{ asOf: "2026-07-14" },
	);
	assert.throws(
		() =>
			parseFinancialMigrationPreflightArguments([
				"--as-of",
				"2026-02-30",
			]),
		/real calendar date/,
	);
	assert.throws(
		() => parseFinancialMigrationPreflightArguments(["--organization-id"]),
		/Unknown argument/,
	);
});

test("reports every organization deterministically and fails on any mismatch", async () => {
	const queried: string[] = [];
	const result = await buildFinancialMigrationPreflight("2026-07-15", {
		listOrganizationIds: async () => ["org-b", "org-a", "org-c"],
		queryOrganization: async (organizationId) => {
			queried.push(organizationId);
			return report(
				organizationId,
				organizationId === "org-b" ? ["mismatch-1", "mismatch-2"] : [],
			);
		},
	});

	assert.deepEqual(queried, ["org-a", "org-b", "org-c"]);
	assert.equal(result.organizationCount, 3);
	assert.equal(result.mismatchedOrganizationCount, 1);
	assert.equal(result.mismatchCount, 2);
	assert.deepEqual(
		result.organizations.map((item) => item.organizationId),
		["org-b"],
	);
});
