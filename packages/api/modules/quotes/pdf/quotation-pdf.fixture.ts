import type {
	QuotationBrandingSnapshotV1,
	QuotationDocumentV1,
} from "../../studio/schemas/quotation-document";
import type { QuotationPdfInput } from "./types";

export const quotationDocumentFixture = (): QuotationDocumentV1 => ({
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

export const quotationBrandingFixture = {
	schemaVersion: 1,
	organizationName: "Studio Test",
	address: "Bhubaneswar",
	email: "hello@example.invalid",
	phone: null,
	taxIdentifier: null,
	timezone: "Asia/Kolkata",
	logoStorageKey: null,
	logoMimeType: null,
	logoSha256: null,
} as const satisfies QuotationBrandingSnapshotV1;

export function quotationPdfInputFixture(): QuotationPdfInput {
	return {
		document: quotationDocumentFixture(),
		branding: quotationBrandingFixture,
		quoteNumber: "QT-2026-0001",
		quoteVersion: 1,
		validUntil: "2026-08-17T18:29:59.999Z",
		createdAt: "2026-08-03T10:00:00.000Z",
	};
}
