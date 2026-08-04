import { createHash } from "node:crypto";
import type {
	BookingBlueprintV2,
	QuotationDocumentV1,
} from "../../studio/schemas/quotation-document";
import {
	bookingBlueprintV2Schema,
	quotationDocumentV1Schema,
} from "../../studio/schemas/quotation-document";

const nullIfBlank = (value: string | null): string | null => {
	const normalized = value?.trim() ?? "";
	return normalized || null;
};

export function normalizeQuotationDocument(
	document: QuotationDocumentV1,
): QuotationDocumentV1 {
	return quotationDocumentV1Schema.parse({
		...document,
		quotationType: {
			...document.quotationType,
			label: document.quotationType.label.trim(),
		},
		title: document.title.trim(),
		termsConfiguration: document.termsConfiguration
			? {
					...document.termsConfiguration,
					label: document.termsConfiguration.label.trim(),
				}
			: null,
		participants: document.participants.map((participant) => ({
			...participant,
			contact: {
				name: participant.contact.name.trim(),
				email:
					nullIfBlank(participant.contact.email)?.toLowerCase() ??
					null,
				phoneNumber: nullIfBlank(participant.contact.phoneNumber),
				alternatePhone: nullIfBlank(participant.contact.alternatePhone),
				address: nullIfBlank(participant.contact.address),
				profession: nullIfBlank(participant.contact.profession),
				source: nullIfBlank(participant.contact.source),
				socialHandle: nullIfBlank(participant.contact.socialHandle),
				notes: nullIfBlank(participant.contact.notes),
			},
		})),
		events: document.events.map((event) => ({
			...event,
			eventType: {
				...event.eventType,
				label: event.eventType.label.trim(),
			},
			guestCount: nullIfBlank(event.guestCount),
			fixedDate: event.timelineMode === "fixed" ? event.fixedDate : null,
			dateWindow:
				event.timelineMode === "tentative"
					? nullIfBlank(event.dateWindow)
					: null,
			location: nullIfBlank(event.location),
			notes: nullIfBlank(event.notes),
		})),
		packages: document.packages.map((item) => ({
			...item,
			name: item.name.trim(),
			summary: nullIfBlank(item.summary),
			configuration: item.configuration
				? {
						...item.configuration,
						label: item.configuration.label.trim(),
						description: nullIfBlank(
							item.configuration.description,
						),
					}
				: null,
			coverage: item.coverage.map((coverage) => ({
				...coverage,
				roles: nullIfBlank(coverage.roles),
			})),
			deliverables: item.deliverables.map((deliverable) => ({
				...deliverable,
				name: deliverable.name.trim(),
				details: nullIfBlank(deliverable.details),
			})),
		})),
		deliveryTimelines: document.deliveryTimelines
			.map((clause) => ({ ...clause, text: clause.text.trim() }))
			.filter(({ text }) => text.length > 0),
		paymentMilestones: document.paymentMilestones.map((milestone) => ({
			...milestone,
			label: milestone.label.trim(),
			timing: milestone.timing.trim(),
		})),
		fixedTerms: document.fixedTerms
			.map((clause) => ({ ...clause, text: clause.text.trim() }))
			.filter(({ text }) => text.length > 0),
	});
}

function sortCanonical(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(sortCanonical);
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, child]) => [key, sortCanonical(child)]),
		);
	}
	return value;
}

export function canonicalQuotationJson(value: unknown): string {
	return JSON.stringify(sortCanonical(value));
}

export function quotationDocumentSha256(document: QuotationDocumentV1): string {
	return createHash("sha256")
		.update(canonicalQuotationJson(document))
		.digest("hex");
}

export function generateQuotationTitle(
	clientNames: string[],
	quotationType: string,
): string {
	const names = clientNames.map((name) => name.trim()).filter(Boolean);
	const prefix = names.length > 0 ? `${names.join(" and ")} - ` : "";
	return `${prefix}${quotationType.trim()} quotation`;
}

export interface PackageConfigurationDefaults {
	id: string;
	key: string;
	label: string;
	defaultCost: string | null;
	description: string | null;
	metadata?: {
		defaultDeliverables?: Array<{
			title: string;
			quantity: number;
			details?: string | null;
		}>;
	} | null;
}

export function applyPackageConfiguration(
	item: QuotationDocumentV1["packages"][number],
	configuration: PackageConfigurationDefaults,
	createKey: () => string,
): QuotationDocumentV1["packages"][number] {
	return {
		...item,
		configuration: {
			id: configuration.id,
			key: configuration.key,
			label: configuration.label,
			defaultCost: configuration.defaultCost,
			description: configuration.description,
		},
		name: configuration.label,
		price: configuration.defaultCost,
		summary: configuration.description,
		deliverables: (configuration.metadata?.defaultDeliverables ?? []).map(
			(deliverable) => ({
				key: createKey(),
				name: deliverable.title,
				quantity: deliverable.quantity,
				details: nullIfBlank(deliverable.details ?? null),
			}),
		),
	};
}

export function synchronizeCoverage(
	packages: QuotationDocumentV1["packages"],
	events: QuotationDocumentV1["events"],
	createKey: () => string,
): QuotationDocumentV1["packages"] {
	const eventKeys = new Set(events.map(({ key }) => key));
	return packages.map((item) => {
		const existing = new Map(
			item.coverage
				.filter(({ eventKey }) => eventKeys.has(eventKey))
				.map((coverage) => [coverage.eventKey, coverage]),
		);
		return {
			...item,
			coverage: events.map(
				(event) =>
					existing.get(event.key) ?? {
						key: createKey(),
						eventKey: event.key,
						roles: null,
					},
			),
		};
	});
}

export function allocateMilestoneAmounts(
	total: string,
	milestones: QuotationDocumentV1["paymentMilestones"],
): Array<{ key: string; amount: string }> {
	const parseScaled = (value: string, scale: number): bigint => {
		const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
		if (!match?.[1] || (match[2]?.length ?? 0) > scale) {
			throw new Error(`Invalid decimal value: ${value}`);
		}
		return BigInt(`${match[1]}${(match[2] ?? "").padEnd(scale, "0")}`);
	};
	const formatCents = (value: bigint): string => {
		const whole = value / BigInt(100);
		const fraction = (value % BigInt(100)).toString().padStart(2, "0");
		return `${whole}.${fraction}`;
	};
	const totalCents = parseScaled(total, 2);
	const positive = milestones
		.map((milestone) => ({
			milestone,
			percentageHundredths: parseScaled(milestone.percentage, 2),
		}))
		.filter(({ percentageHundredths }) => percentageHundredths > BigInt(0));
	let allocated = BigInt(0);
	return positive.map(({ milestone, percentageHundredths }, index) => {
		const cents =
			index === positive.length - 1
				? totalCents - allocated
				: (totalCents * percentageHundredths + BigInt(5000)) /
					BigInt(10_000);
		allocated += cents;
		return {
			key: milestone.key,
			amount: formatCents(cents),
		};
	});
}

export function assembleBookingBlueprintV2(
	document: QuotationDocumentV1,
	optionKey: string,
): BookingBlueprintV2 {
	const item = document.packages.find(
		(candidate) => candidate.key === optionKey,
	);
	if (!item) {
		throw new Error("Quotation package not found");
	}
	const coverage = new Map(
		item.coverage.map((row) => [row.eventKey, row.roles]),
	);
	return bookingBlueprintV2Schema.parse({
		schemaVersion: 2,
		sourceDocumentVersion: 1,
		optionKey,
		booking: {
			name: document.title,
			bookingDateStrategy: "acceptanceDateInOrganizationTimezone",
			bookingType: document.quotationType.label,
			packageType: item.name,
			events: document.events.map((event) => ({
				documentKey: event.key,
				eventType: event.eventType.label,
				side: event.side,
				guestCount: event.guestCount,
				isTentative: event.timelineMode === "tentative",
				eventDate: event.fixedDate,
				dateWindow: event.dateWindow,
				location: event.location,
				notes: event.notes,
				coverageNotes: coverage.get(event.key) ?? null,
			})),
			deliverables: item.deliverables.map((deliverable) => ({
				documentKey: deliverable.key,
				name: deliverable.name,
				quantity: deliverable.quantity,
				description: deliverable.details,
				isPackageIncluded: true,
			})),
			paymentMilestones: document.paymentMilestones
				.filter(({ percentage }) => Number(percentage) > 0)
				.map((milestone) => ({
					documentKey: milestone.key,
					label: milestone.label,
					percentage: milestone.percentage,
					timing: milestone.timing,
				})),
		},
	});
}
