import { describe, expect, it, vi } from "vitest";
import { createDefaultQuotationDraft } from "./quotation-wizard-data";
import { quotationDraftToDocument } from "./quotation-wizard-document";
import {
	focusFirstQuotationError,
	validateQuotationDocument,
} from "./quotation-wizard-validation";

describe("quotation wizard validation", () => {
	it("validates a tentative event as a date window rather than a fixed date", () => {
		const draft = createDefaultQuotationDraft("2026-08-03");
		const event = draft.events[0];
		if (!event) {
			throw new Error("Default event is missing");
		}
		const tentativeEvent = {
			...event,
			name: "Common ceremony",
			tentative: true,
			date: "January to February 2027",
		};
		draft.events[0] = tentativeEvent;
		expect(
			validateQuotationDocument(
				quotationDraftToDocument(draft),
				"events",
			),
		).toEqual([]);

		draft.events[0] = { ...tentativeEvent, date: "" };
		expect(
			validateQuotationDocument(
				quotationDraftToDocument(draft),
				"events",
			),
		).toEqual([
			expect.objectContaining({
				fieldId: `quotation-event-${draft.events[0]?.id}-date`,
				message: "Tentative events require a date window only",
			}),
		]);
	});

	it("maps a missing recommended package to the rendered package name id", () => {
		const draft = createDefaultQuotationDraft("2026-08-03");
		const firstPackage = draft.packages[0];
		if (!firstPackage) {
			throw new Error("Default package is missing");
		}
		draft.selectedPackageId = "missing-package";
		const errors = validateQuotationDocument(
			quotationDraftToDocument(draft),
			"packages",
		);
		expect(errors).toContainEqual(
			expect.objectContaining({
				fieldId: `quotation-package-${firstPackage.id}-name`,
			}),
		);
	});

	it("switches step and focuses the first invalid field after rendering", () => {
		const focus = vi.fn();
		const setStep = vi.fn();
		const schedule = vi.fn((callback: () => void) => callback());
		focusFirstQuotationError(
			{
				fieldId: "quotation-title",
				message: "Title is required",
				step: "client",
			},
			setStep,
			(id) => (id === "quotation-title" ? { focus } : null),
			schedule,
		);
		expect(setStep).toHaveBeenCalledWith("client");
		expect(schedule).toHaveBeenCalledOnce();
		expect(focus).toHaveBeenCalledOnce();
	});
});
