import { describe, expect, it } from "vitest";
import {
	dateTimeLocalToIso,
	isoToDateTimeLocal,
	isoToOrganizationDate,
	organizationDateToEndOfDayIso,
} from "./quotation-date-helpers";
import {
	attachmentKeysToDelete,
	createEmptyQuoteDraft,
	getEditorErrorTarget,
	getQuoteActions,
	normalizeQuotationListParams,
	optionTotal,
	optionTotalCents,
	paymentSchedulesMatchOptionTotal,
	type QuotePresentationCapabilities,
	shouldGuardSpaNavigation,
} from "./quotation-helpers";

const owner: QuotePresentationCapabilities = {
	readOperational: true,
	create: true,
	update: true,
	send: true,
	revise: true,
	accept: true,
	decline: true,
	expire: true,
	convert: true,
};
const manager: QuotePresentationCapabilities = {
	...owner,
	readOperational: false,
	create: false,
	accept: false,
	decline: false,
	expire: false,
	convert: false,
};

it("keeps manager draft actions summary-only", () => {
	expect(
		getQuoteActions({ status: "draft", expiresAt: null }, manager),
	).toEqual(["send"]);
	expect(
		getQuoteActions({ status: "sent", expiresAt: null }, manager),
	).toEqual(["revise"]);
});

it("shows operational actions only in valid lifecycle states", () => {
	expect(
		getQuoteActions({ status: "draft", expiresAt: null }, owner),
	).toEqual(["edit", "send"]);
	expect(
		getQuoteActions({ status: "accepted", expiresAt: null }, owner),
	).toEqual(["revise", "convert"]);
	expect(
		getQuoteActions({ status: "superseded", expiresAt: null }, owner),
	).toEqual([]);
	expect(
		getQuoteActions({ status: "converted", expiresAt: null }, owner),
	).toEqual([]);
	expect(
		getQuoteActions(
			{ status: "sent", expiresAt: "2025-01-01T00:00:00.000Z" },
			owner,
			new Date("2025-01-02T00:00:00.000Z"),
		),
	).toEqual(["revise", "decline", "expire"]);
});

it("does not offer API-rejected actions for due drafts or sent quotes", () => {
	const due = "2025-01-01T00:00:00.000Z";
	const now = new Date("2025-01-02T00:00:00.000Z");
	expect(
		getQuoteActions({ status: "draft", expiresAt: due }, owner, now),
	).toEqual(["edit"]);
	expect(
		getQuoteActions({ status: "sent", expiresAt: due }, manager, now),
	).toEqual(["revise"]);
});

describe("quotation URL normalization", () => {
	it("accepts only schema-backed page, status, sort, direction, and client values", () => {
		const params = new URLSearchParams({
			page: "3",
			status: "accepted",
			client: "0192d48e-7c9a-7000-8000-000000000001",
			sort: "quoteNumber:asc",
		});
		expect(normalizeQuotationListParams(params)).toEqual({
			page: 3,
			status: "accepted",
			clientId: "0192d48e-7c9a-7000-8000-000000000001",
			sortBy: "quoteNumber",
			sortDirection: "asc",
		});
	});

	it("falls back safely for malformed or unsupported URL input", () => {
		const params = new URLSearchParams({
			page: "-2.5",
			status: "paid",
			client: "not-an-id",
			sort: "totalAmount:sideways",
		});
		expect(normalizeQuotationListParams(params)).toEqual({
			page: 1,
			status: "all",
			clientId: "all",
			sortBy: "createdAt",
			sortDirection: "desc",
		});
	});
});

describe("draft mapping", () => {
	it("starts with one primary participant, option and line", () => {
		const draft = createEmptyQuoteDraft();
		expect(draft.participants).toHaveLength(1);
		expect(draft.participants[0]?.isPrimary).toBe(true);
		expect(draft.options[0]?.bookingBlueprint.schemaVersion).toBe(1);
	});

	it("derives preview totals without sending caller-owned totals", () => {
		const option = createEmptyQuoteDraft().options[0];
		if (!option) {
			throw new Error("missing option");
		}
		option.lineItems = [
			{
				type: "service",
				description: "Coverage",
				quantity: "2",
				unitPrice: "100.00",
			},
			{ type: "expense", description: "Travel", amount: "50.00" },
		];
		option.discountAmount = "25.00";
		option.taxAmount = "18.00";
		expect(optionTotal(option)).toBe(243);
		expect(option).not.toHaveProperty("totalAmount");
	});

	it("matches server half-up line rounding and schedules in integer cents", () => {
		const option = createEmptyQuoteDraft().options[0];
		if (!option) {
			throw new Error("missing option");
		}
		option.lineItems = [
			{
				type: "service",
				description: "Fractional coverage",
				quantity: "1.25",
				unitPrice: "10.01",
			},
		];
		option.bookingBlueprint.booking.paymentSchedules = [
			{ name: "Deposit", amount: "12.51", dueDate: "2026-08-02" },
		];
		expect(optionTotalCents(option)).toBe(BigInt(1251));
		expect(optionTotal(option)).toBe(12.51);
		expect(paymentSchedulesMatchOptionTotal(option)).toBe(true);
		const schedule = option.bookingBlueprint.booking.paymentSchedules?.[0];
		if (!schedule) {
			throw new Error("missing schedule");
		}
		schedule.amount = "12.50";
		expect(paymentSchedulesMatchOptionTotal(option)).toBe(false);
	});

	it("rejects excessive discounts exactly like the server and never matches schedules", () => {
		const option = createEmptyQuoteDraft().options[0];
		if (!option) {
			throw new Error("missing option");
		}
		option.lineItems[0] = {
			type: "service",
			description: "Coverage",
			quantity: "1",
			unitPrice: "100.00",
		};
		option.discountAmount = "100.01";
		option.bookingBlueprint.booking.paymentSchedules = [
			{ name: "Deposit", amount: "0.00", dueDate: "2026-08-02" },
		];
		expect(optionTotalCents(option)).toBeNull();
		expect(paymentSchedulesMatchOptionTotal(option)).toBe(false);
	});
});

describe("timezone-safe quotation dates", () => {
	it("roundtrips datetime-local values outside UTC", () => {
		const local = "2026-08-02T19:45";
		const iso = dateTimeLocalToIso(local, "Asia/Kolkata");
		expect(iso).toBe("2026-08-02T14:15:00.000Z");
		expect(isoToDateTimeLocal(iso, "Asia/Kolkata")).toBe(local);
	});

	it("uses organization end-of-day for India expiry", () => {
		const iso = organizationDateToEndOfDayIso("2026-08-02", "Asia/Kolkata");
		expect(iso).toBe("2026-08-02T18:29:59.999Z");
		expect(isoToOrganizationDate(iso, "Asia/Kolkata")).toBe("2026-08-02");
	});
});

it("keeps the saved attachment until save and cleans only staged uploads on discard", () => {
	expect(
		attachmentKeysToDelete({
			initialKeys: ["saved"],
			currentKeys: ["new-b"],
			uploadedKeys: ["new-a", "new-b"],
			includeInitial: false,
		}),
	).toEqual(["new-a"]);
	expect(
		attachmentKeysToDelete({
			initialKeys: ["saved"],
			currentKeys: ["new-b"],
			uploadedKeys: ["new-a", "new-b"],
			includeInitial: true,
		}),
	).toEqual(["new-a", "saved"]);
});

it("guards SPA route changes but not same-page hashes or external links", () => {
	const current = new URL("https://studio.test/app/acme/quotations/new");
	expect(
		shouldGuardSpaNavigation(
			current,
			new URL("https://studio.test/app/acme"),
		),
	).toBe(true);
	expect(
		shouldGuardSpaNavigation(
			current,
			new URL("https://studio.test/app/acme/quotations/new#pricing"),
		),
	).toBe(false);
	expect(
		shouldGuardSpaNavigation(current, new URL("https://example.com/away")),
	).toBe(false);
});

it("maps nested schema errors to their visible step and focus control", () => {
	expect(
		getEditorErrorTarget([
			"options",
			2,
			"bookingBlueprint",
			"booking",
			"shoots",
			0,
			"crewAssignments",
			0,
			"role",
		]),
	).toEqual({
		key: "options.2.shoots",
		step: "operations",
		controlId: "quotation-shoots",
		optionIndex: 2,
	});
	expect(getEditorErrorTarget(["participants", 0, "side"]).controlId).toBe(
		"quotation-participants",
	);
	expect(getEditorErrorTarget(["terms", 0])).toEqual({
		key: "terms",
		step: "proposal",
		controlId: "quotation-terms",
	});
});
