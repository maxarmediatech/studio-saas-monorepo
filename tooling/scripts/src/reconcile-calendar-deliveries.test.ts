import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCalendarReconciliationArguments } from "./reconcile-calendar-deliveries";

describe("calendar reconciliation CLI", () => {
	it("accepts an explicit organization id", () => {
		assert.deepEqual(
			parseCalendarReconciliationArguments([
				"--apply",
				"--organization-id",
				"org_1",
			]),
			{ apply: true, organizationId: "org_1" },
		);
	});

	for (const args of [
		["--apply"],
		["--organization-id"],
		["--organization-id", ""],
		["--organization-id", "--apply"],
		["--organization-id="],
		["--organization-id=--apply"],
		["--unknown"],
		["org_1"],
		["--apply", "--apply", "--organization-id", "org_1"],
		["--organization-id", "org_1", "--organization-id=org_2"],
	]) {
		it(`rejects ${args.join(" ") || "missing value"}`, () => {
			assert.throws(() => parseCalendarReconciliationArguments(args));
		});
	}
});
