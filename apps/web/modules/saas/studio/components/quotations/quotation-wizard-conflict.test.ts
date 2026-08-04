import { describe, expect, it } from "vitest";
import { shouldAutosaveQuotationDraft } from "./quotation-wizard-conflict";

describe("quotation wizard conflict pause", () => {
	it("does not resume stale autosave after copying unsaved values", () => {
		expect(
			shouldAutosaveQuotationDraft({
				loaded: true,
				dirty: true,
				conflictPaused: true,
			}),
		).toBe(false);
		expect(
			shouldAutosaveQuotationDraft({
				loaded: true,
				dirty: true,
				conflictPaused: false,
			}),
		).toBe(true);
	});
});
