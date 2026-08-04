import { describe, expect, it } from "vitest";
import type { QuotationDocumentV1 } from "../../studio/schemas/quotation-document";
import {
	quotationDocumentV1Schema,
	strictQuotationDocumentV1Schema,
} from "../../studio/schemas/quotation-document";
import {
	allocateMilestoneAmounts,
	applyPackageConfiguration,
	assembleBookingBlueprintV2,
	generateQuotationTitle,
	normalizeQuotationDocument,
	quotationDocumentSha256,
	synchronizeCoverage,
} from "./quotation-document";

const documentFixture = (): QuotationDocumentV1 => ({
	schemaVersion: 1,
	quotationDate: "2026-08-03",
	quotationType: { id: "type-1", key: "wedding", label: "Wedding" },
	title: "A and B - Wedding quotation",
	currency: "INR",
	participants: [
		{
			key: "participant-1",
			clientId: "client-1",
			clientUpdatedAt: "2026-08-03T10:00:00.000Z",
			contact: {
				name: "A",
				email: null,
				phoneNumber: null,
				alternatePhone: null,
				address: null,
				profession: null,
				source: null,
				socialHandle: null,
				notes: null,
			},
		},
	],
	events: [
		{
			key: "event-1",
			eventType: {
				id: "event-type-1",
				key: "ceremony",
				label: "Ceremony",
			},
			side: "bride",
			guestCount: "200",
			timelineMode: "fixed",
			fixedDate: "2026-12-10",
			dateWindow: null,
			location: "Jaipur",
			notes: null,
		},
	],
	packages: [
		{
			key: "package-1",
			configuration: null,
			name: "Classic",
			price: "1000.01",
			summary: null,
			coverage: [
				{
					key: "coverage-1",
					eventKey: "event-1",
					roles: "2 photographers",
				},
			],
			deliverables: [
				{
					key: "deliverable-1",
					name: "Album",
					quantity: 1,
					details: null,
				},
			],
		},
	],
	recommendedPackageKey: "package-1",
	deliveryTimelines: [],
	paymentMilestones: [
		{
			key: "payment-1",
			label: "Advance",
			percentage: "33.33",
			timing: "Booking",
		},
		{
			key: "payment-2",
			label: "Second",
			percentage: "33.33",
			timing: "Event",
		},
		{
			key: "payment-3",
			label: "Final",
			percentage: "33.34",
			timing: "Delivery",
		},
	],
	fixedTerms: [],
});

describe("quotation document v1", () => {
	it("normalizes optional empty strings without losing shape", () => {
		const document = documentFixture();
		const participant = document.participants[0];
		const event = document.events[0];
		if (!participant || !event) {
			throw new Error("Fixture is incomplete");
		}
		participant.contact.address = "  ";
		event.location = " Jaipur ";
		expect(
			normalizeQuotationDocument(document).participants[0]?.contact
				.address,
		).toBeNull();
		expect(normalizeQuotationDocument(document).events[0]?.location).toBe(
			"Jaipur",
		);
	});

	it("permits a cleared draft date but rejects it for send", () => {
		const document = documentFixture();
		document.quotationDate = "";
		expect(quotationDocumentV1Schema.safeParse(document).success).toBe(
			true,
		);
		expect(
			strictQuotationDocumentV1Schema.safeParse(document).success,
		).toBe(false);
	});

	it("keeps historical unused zero-percent payment rows compatible", () => {
		const document = documentFixture();
		document.paymentMilestones = [
			{
				key: "payment-1",
				label: "Full payment",
				percentage: "100",
				timing: "Booking",
			},
			{ key: "payment-2", label: "", percentage: "0", timing: "" },
			{ key: "payment-3", label: "", percentage: "0", timing: "" },
		];
		expect(
			strictQuotationDocumentV1Schema.safeParse(document).success,
		).toBe(true);
	});

	it("validates event sides and fixed/tentative exclusivity", () => {
		const document = documentFixture();
		const event = document.events[0];
		if (!event) {
			throw new Error("Fixture is incomplete");
		}
		document.events[0] = {
			...event,
			timelineMode: "tentative",
			fixedDate: null,
			dateWindow: "Winter 2027",
			side: "separateCommon",
		};
		expect(
			strictQuotationDocumentV1Schema.safeParse(document).success,
		).toBe(true);
		document.events[0].fixedDate = "2027-01-01";
		expect(
			strictQuotationDocumentV1Schema.safeParse(document).success,
		).toBe(false);
	});

	it("generates titles and applies package defaults once", () => {
		expect(generateQuotationTitle(["A", "B"], "Wedding")).toBe(
			"A and B - Wedding quotation",
		);
		const packageOption = documentFixture().packages[0];
		if (!packageOption) {
			throw new Error("Fixture is incomplete");
		}
		const applied = applyPackageConfiguration(
			packageOption,
			{
				id: "configuration-1",
				key: "premium",
				label: "Premium",
				defaultCost: "125000.00",
				description: "Complete coverage",
				metadata: {
					defaultDeliverables: [
						{ title: "Film", quantity: 1, details: "4K" },
					],
				},
			},
			() => "generated-key",
		);
		expect(applied).toMatchObject({
			name: "Premium",
			price: "125000.00",
			summary: "Complete coverage",
		});
		expect(applied.deliverables[0]).toMatchObject({
			name: "Film",
			details: "4K",
		});
	});

	it("synchronizes event coverage without changing surviving rows", () => {
		const document = documentFixture();
		const event = document.events[0];
		if (!event) {
			throw new Error("Fixture is incomplete");
		}
		document.events.push({ ...event, key: "event-2" });
		const [item] = synchronizeCoverage(
			document.packages,
			document.events,
			() => "coverage-2",
		);
		expect(item?.coverage).toEqual([
			{
				key: "coverage-1",
				eventKey: "event-1",
				roles: "2 photographers",
			},
			{ key: "coverage-2", eventKey: "event-2", roles: null },
		]);
	});

	it("allocates indivisible cents with the remainder in the final row", () => {
		expect(
			allocateMilestoneAmounts(
				"1000.01",
				documentFixture().paymentMilestones,
			),
		).toEqual([
			{ key: "payment-1", amount: "333.30" },
			{ key: "payment-2", amount: "333.30" },
			{ key: "payment-3", amount: "333.41" },
		]);
	});

	it("allocates maximum money and one-cent totals without binary floats", () => {
		const milestones = documentFixture().paymentMilestones;
		expect(allocateMilestoneAmounts("99999999.99", milestones)).toEqual([
			{ key: "payment-1", amount: "33330000.00" },
			{ key: "payment-2", amount: "33330000.00" },
			{ key: "payment-3", amount: "33339999.99" },
		]);
		expect(allocateMilestoneAmounts("0.01", milestones)).toEqual([
			{ key: "payment-1", amount: "0.00" },
			{ key: "payment-2", amount: "0.00" },
			{ key: "payment-3", amount: "0.01" },
		]);
	});

	it("assembles blueprint v2 without operational inventions", () => {
		const document = documentFixture();
		document.deliveryTimelines = [{ key: "timeline", text: "Eight weeks" }];
		document.fixedTerms = [{ key: "backup", text: "Backup for 90 days" }];
		const blueprint = assembleBookingBlueprintV2(document, "package-1");
		expect(blueprint.booking.events[0]).toMatchObject({
			side: "bride",
			coverageNotes: "2 photographers",
			isTentative: false,
		});
		expect(blueprint.booking.deliverables[0]).toMatchObject({
			isPackageIncluded: true,
		});
		expect(blueprint.booking).not.toHaveProperty("shoots");
		expect(blueprint.booking.paymentMilestones).toHaveLength(3);
		expect(blueprint.booking).not.toHaveProperty("deliveryTimelines");
		expect(blueprint.booking).not.toHaveProperty("fixedTerms");
	});

	it("hashes canonical input stably", () => {
		const first = documentFixture();
		const reordered = Object.fromEntries(
			Object.entries(first).reverse(),
		) as QuotationDocumentV1;
		expect(quotationDocumentSha256(first)).toBe(
			quotationDocumentSha256(reordered),
		);
	});
});
