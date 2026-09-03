import {
	quotationDocumentFixture,
	quotationPdfInputFixture,
} from "../../quotation-pdf.fixture";
import type { QuotationPdfInput } from "../../types";

function prose(marker: string, length: number): string {
	const unit = `${marker} documented detail `;
	return `${marker} ${unit.repeat(Math.ceil(length / unit.length))}`.slice(
		0,
		length,
	);
}

export function neutralMinimalFixture(): QuotationPdfInput {
	return quotationPdfInputFixture();
}

export function neutralNormalFixture(): QuotationPdfInput {
	const base = quotationPdfInputFixture();
	const events = Array.from({ length: 4 }, (_, index) => ({
		key: `normal-event-${index + 1}`,
		eventType: {
			id: `normal-event-type-${index + 1}`,
			key: `normal-event-type-${index + 1}`,
			label: `NORMAL-EVENT-${index + 1}`,
		},
		side: "bride" as const,
		guestCount: String(120 + index * 30),
		timelineMode: "fixed" as const,
		fixedDate: `2026-12-${String(10 + index).padStart(2, "0")}`,
		dateWindow: null,
		location: `NORMAL-LOCATION-${index + 1}`,
		notes: prose(`NORMAL-EVENT-NOTE-${index + 1}`, 420),
	}));
	const packages = Array.from({ length: 3 }, (_, packageIndex) => ({
		key: `normal-package-${packageIndex + 1}`,
		configuration: null,
		name: `NORMAL-PACKAGE-${packageIndex + 1}`,
		price: String(75_000 + packageIndex * 25_000),
		summary: prose(`NORMAL-SUMMARY-${packageIndex + 1}`, 700),
		coverage: events.map((event, eventIndex) => ({
			key: `normal-coverage-${packageIndex + 1}-${eventIndex + 1}`,
			eventKey: event.key,
			roles: prose(
				`NORMAL-COVERAGE-${packageIndex + 1}-${eventIndex + 1}`,
				260,
			),
		})),
		deliverables: Array.from({ length: 6 }, (_, deliverableIndex) => ({
			key: `normal-deliverable-${packageIndex + 1}-${deliverableIndex + 1}`,
			name: `NORMAL-DELIVERABLE-${packageIndex + 1}-${deliverableIndex + 1}`,
			quantity: deliverableIndex + 1,
			details: prose(
				`NORMAL-DELIVERABLE-DETAIL-${packageIndex + 1}-${deliverableIndex + 1}`,
				420,
			),
		})),
	}));
	return {
		...base,
		quoteNumber: "QT-NORMAL-0001",
		document: {
			...quotationDocumentFixture(),
			title: "NORMAL-QUOTATION",
			participants: Array.from({ length: 3 }, (_, index) => ({
				key: `normal-participant-${index + 1}`,
				clientId: `normal-client-${index + 1}`,
				clientUpdatedAt: `2026-08-03T10:0${index}:00.000Z`,
				contact: {
					name: `NORMAL-PARTICIPANT-${index + 1}`,
					email: `normal-${index + 1}@example.invalid`,
					phoneNumber: `+9100000000${index}`,
					alternatePhone: null,
					address: prose(`NORMAL-ADDRESS-${index + 1}`, 320),
					profession: `NORMAL-PROFESSION-${index + 1}`,
					source: "NORMAL-SOURCE",
					socialHandle: `@normal${index + 1}`,
					notes: `NORMAL-PARTICIPANT-NOTE-${index + 1}`,
				},
			})),
			events,
			packages,
			recommendedPackageKey: "normal-package-2",
			deliveryTimelines: Array.from({ length: 4 }, (_, index) => ({
				key: `normal-delivery-${index + 1}`,
				text: prose(`NORMAL-DELIVERY-${index + 1}`, 420),
			})),
			fixedTerms: Array.from({ length: 6 }, (_, index) => ({
				key: `normal-term-${index + 1}`,
				text: prose(`NORMAL-TERM-${index + 1}`, 620),
			})),
		},
	};
}

export function neutralBoundaryFixture(): QuotationPdfInput {
	const base = quotationPdfInputFixture();
	const events = Array.from({ length: 20 }, (_, index) => ({
		key: `boundary-event-${index + 1}`,
		eventType: {
			id: `boundary-event-type-${index + 1}`,
			key: `boundary-event-type-${index + 1}`,
			label: `BND-EVENT-${String(index + 1).padStart(2, "0")}`,
		},
		side: "bride" as const,
		guestCount: String(100 + index),
		timelineMode: "fixed" as const,
		fixedDate: `2027-01-${String(index + 1).padStart(2, "0")}`,
		dateWindow: null,
		location: `BND-LOCATION-${String(index + 1).padStart(2, "0")}`,
		notes: prose(`BND-EVENT-NOTE-${index + 1}`, 300),
	}));
	const packages = Array.from({ length: 10 }, (_, packageIndex) => ({
		key: `boundary-package-${packageIndex + 1}`,
		configuration: null,
		name: `BND-PACKAGE-${String(packageIndex + 1).padStart(2, "0")}`,
		price: String(100_000 + packageIndex * 10_000),
		summary: prose(`BND-SUMMARY-${packageIndex + 1}`, 250),
		coverage: events
			.slice(packageIndex, packageIndex + 10)
			.map((event, coverageIndex) => ({
				key: `boundary-coverage-${packageIndex + 1}-${coverageIndex + 1}`,
				eventKey: event.key,
				roles: prose(
					`BND-COVERAGE-${packageIndex + 1}-${coverageIndex + 1}`,
					160,
				),
			})),
		deliverables: Array.from({ length: 20 }, (_, deliverableIndex) => ({
			key: `boundary-deliverable-${packageIndex + 1}-${deliverableIndex + 1}`,
			name: `BND-DELIVERABLE-${packageIndex + 1}-${deliverableIndex + 1}`,
			quantity: deliverableIndex + 1,
			details: prose(
				`BND-DELIVERABLE-DETAIL-${packageIndex + 1}-${deliverableIndex + 1}`,
				180,
			),
		})),
	}));
	return {
		...base,
		quoteNumber: "QT-BOUNDARY-0001",
		document: {
			...quotationDocumentFixture(),
			title: "BND-QUOTATION",
			participants: Array.from({ length: 10 }, (_, index) => ({
				key: `boundary-participant-${index + 1}`,
				clientId: `boundary-client-${index + 1}`,
				clientUpdatedAt: `2026-08-03T10:${String(index).padStart(2, "0")}:00.000Z`,
				contact: {
					name: `BND-PARTICIPANT-${String(index + 1).padStart(2, "0")}`,
					email: `boundary-${index + 1}@example.invalid`,
					phoneNumber: `+9199000000${String(index).padStart(2, "0")}`,
					alternatePhone: null,
					address: prose(`BND-ADDRESS-${index + 1}`, 200),
					profession: `BND-PROFESSION-${index + 1}`,
					source: "BND-SOURCE",
					socialHandle: `@boundary${index + 1}`,
					notes: `BND-PARTICIPANT-NOTE-${index + 1}`,
				},
			})),
			events,
			packages,
			recommendedPackageKey: "boundary-package-5",
			deliveryTimelines: Array.from({ length: 20 }, (_, index) => ({
				key: `boundary-delivery-${index + 1}`,
				text: prose(`BND-DELIVERY-${index + 1}`, 300),
			})),
			fixedTerms: Array.from({ length: 30 }, (_, index) => ({
				key: `boundary-term-${index + 1}`,
				text: prose(`BND-TERM-${index + 1}`, 550),
			})),
		},
	};
}
