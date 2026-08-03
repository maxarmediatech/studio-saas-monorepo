import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sanitizer = readFileSync(
	new URL("../staging-clone/sanitizers/studio.ts", import.meta.url),
	"utf8",
);

test("quotation sanitizer covers every duplicated free-text snapshot", () => {
	for (const contract of [
		"Sanitized quotation type",
		"Sanitized event type",
		"Sanitized package configuration",
		"Sanitized deliverable",
		"Sanitized payment milestone",
		"sanitize_quotation_blueprint",
		"UPDATE quote_options SET",
		"UPDATE quote_line_items SET",
		"option_snapshot = CASE",
		"Sanitized accepted package description",
		"bookingBlueprint",
		"lineItems",
		"pdf_snapshot = NULL",
	]) {
		assert.ok(sanitizer.includes(contract), contract);
	}
});
