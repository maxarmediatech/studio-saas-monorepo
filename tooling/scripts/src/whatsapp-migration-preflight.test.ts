import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	parseWhatsAppMigrationPreflightArguments,
	summarizeWhatsAppIdentityIssues,
	type WhatsAppIdentityIssue,
} from "./whatsapp-migration-preflight";

describe("WhatsApp migration preflight CLI", () => {
	it("requires one explicit report scope", () => {
		assert.deepEqual(
			parseWhatsAppMigrationPreflightArguments([
				"--organization-id",
				"org_1",
			]),
			{ organizationId: "org_1", allOrganizations: false },
		);
		assert.deepEqual(
			parseWhatsAppMigrationPreflightArguments(["--all-organizations"]),
			{ organizationId: null, allOrganizations: true },
		);
	});

	for (const args of [
		[],
		["--organization-id"],
		["--organization-id", ""],
		["--organization-id=--all-organizations"],
		["--all-organizations", "--all-organizations"],
		["--all-organizations", "--organization-id", "org_1"],
		["--unknown"],
	]) {
		it(`rejects ${args.join(" ") || "a missing scope"}`, () => {
			assert.throws(() => parseWhatsAppMigrationPreflightArguments(args));
		});
	}

	it("separates migration-safe ownership backfills from manual blockers", () => {
		const issue = (
			repairability: WhatsAppIdentityIssue["repairability"],
			count: number,
		): WhatsAppIdentityIssue => ({
			kind:
				repairability === "migration_safe"
					? "contact_missing_account_safe_backfill"
					: "contact_wa_id_duplicate",
			repairability,
			organizationIds: ["org_1"],
			accountId: "account_1",
			evidenceHash: "evidence_1",
			rowIds: ["row_1"],
			count,
		});
		assert.deepEqual(
			summarizeWhatsAppIdentityIssues([
				issue("migration_safe", 2),
				issue("manual", 3),
			]),
			{
				issueGroupCount: 2,
				affectedRowCount: 5,
				safeBackfillGroupCount: 1,
				safeBackfillRowCount: 2,
				blockingIssueGroupCount: 1,
				blockingRowCount: 3,
			},
		);
	});
});
