import type { QuotationDocumentV1 } from "@repo/api/modules/studio/schemas/quotation-document";
import type { QuoteDetail } from "@repo/api/modules/studio/schemas/quote";
import type { QuotationDraft } from "./quotation-wizard-data";

const emptyToNull = (value: string) => value.trim() || null;

function addDays(date: string, days: number): string {
	const value = new Date(`${date}T00:00:00Z`);
	value.setUTCDate(value.getUTCDate() + days);
	return value.toISOString().slice(0, 10);
}

export function quotationDraftToDocument(
	draft: QuotationDraft,
): QuotationDocumentV1 {
	return {
		schemaVersion: 1,
		quotationDate: draft.quoteDate,
		quotationType: {
			id: draft.quotationTypeId,
			key: draft.quotationTypeKey,
			label: draft.quotationType,
		},
		title: draft.title,
		currency: "INR",
		participants: draft.clients.map((client) => ({
			key: client.id,
			clientId: client.clientId,
			clientUpdatedAt: client.clientUpdatedAt,
			resolutionIntent: client.persistAsLead ? "create_lead" : "none",
			contact: {
				name: client.name,
				email: emptyToNull(client.email),
				phoneNumber: emptyToNull(client.phoneNumber),
				alternatePhone: emptyToNull(client.alternatePhone),
				address: emptyToNull(client.address),
				profession: emptyToNull(client.profession),
				source: emptyToNull(client.source),
				socialHandle: emptyToNull(client.socialHandle),
				notes: emptyToNull(client.notes),
			},
		})),
		events: draft.events.map((event) => ({
			key: event.id,
			eventType: {
				id: event.eventTypeId,
				key: event.eventTypeKey,
				label: event.name,
			},
			side: event.side,
			guestCount: emptyToNull(event.guestCount),
			timelineMode: event.tentative ? "tentative" : "fixed",
			fixedDate: event.tentative ? null : emptyToNull(event.date),
			dateWindow: event.tentative ? emptyToNull(event.date) : null,
			location: emptyToNull(event.location),
			notes: emptyToNull(event.notes),
		})),
		packages: draft.packages.map((pkg) => ({
			key: pkg.id,
			configuration:
				pkg.configurationId || pkg.configurationKey
					? {
							id: pkg.configurationId,
							key: pkg.configurationKey,
							label: pkg.name,
							defaultCost: pkg.configurationDefaultCost,
							description: pkg.configurationDescription,
						}
					: null,
			name: pkg.name,
			price: emptyToNull(pkg.price),
			summary: emptyToNull(pkg.summary),
			coverage: pkg.coverage.map((item) => ({
				key: item.id,
				eventKey: item.eventId,
				roles: emptyToNull(item.roles),
			})),
			deliverables: pkg.deliverables.map((item) => ({
				key: item.id,
				name: item.name,
				quantity: Number.parseInt(item.quantity, 10) || 1,
				details: emptyToNull(item.details),
			})),
		})),
		recommendedPackageKey: draft.selectedPackageId || null,
		termsConfiguration: draft.termsConfiguration,
		deliveryTimelines: draft.timelines
			.map((text, index) => ({
				key:
					draft.timelineKeys[index] ??
					`timeline-${crypto.randomUUID()}`,
				text,
			}))
			.filter(({ text }) => text.trim()),
		paymentMilestones: draft.payments.map((item) => ({
			key: item.id,
			label: item.label,
			percentage: item.percent,
			timing: item.timing,
		})),
		fixedTerms: draft.terms
			.map((text, index) => ({
				key: draft.termKeys[index] ?? `term-${crypto.randomUUID()}`,
				text,
			}))
			.filter(({ text }) => text.trim()),
	};
}

export function quotationDocumentToWizardDraft(
	document: QuotationDocumentV1,
	expiresAt?: string | null,
): QuotationDraft {
	return {
		title: document.title,
		quoteDate: document.quotationDate,
		quotationType: document.quotationType.label,
		quotationTypeId: document.quotationType.id,
		quotationTypeKey: document.quotationType.key,
		validUntil: expiresAt ?? addDays(document.quotationDate, 14),
		weddingWindow: "",
		notes: "",
		clients: document.participants.map((participant) => ({
			id: participant.key,
			clientId: participant.clientId,
			clientUpdatedAt: participant.clientUpdatedAt,
			persistAsLead: false,
			name: participant.contact.name,
			email: participant.contact.email ?? "",
			phoneNumber: participant.contact.phoneNumber ?? "",
			alternatePhone: participant.contact.alternatePhone ?? "",
			address: participant.contact.address ?? "",
			profession: participant.contact.profession ?? "",
			source: participant.contact.source ?? "",
			socialHandle: participant.contact.socialHandle ?? "",
			notes: participant.contact.notes ?? "",
		})),
		selectedPackageId:
			document.recommendedPackageKey ?? document.packages[0]?.key ?? "",
		events: document.events.map((event) => ({
			id: event.key,
			eventTypeId: event.eventType.id,
			eventTypeKey: event.eventType.key,
			date: event.fixedDate ?? event.dateWindow ?? "",
			side: event.side,
			name: event.eventType.label,
			location: event.location ?? "",
			guestCount: event.guestCount ?? "",
			tentative: event.timelineMode === "tentative",
			notes: event.notes ?? "",
		})),
		packages: document.packages.map((pkg) => ({
			id: pkg.key,
			configurationId: pkg.configuration?.id ?? null,
			configurationKey: pkg.configuration?.key ?? null,
			configurationDefaultCost: pkg.configuration?.defaultCost ?? null,
			configurationDescription: pkg.configuration?.description ?? null,
			name: pkg.name,
			price: pkg.price ?? "",
			summary: pkg.summary ?? "",
			coverage: pkg.coverage.map((item) => {
				const event = document.events.find(
					({ key }) => key === item.eventKey,
				);
				return {
					id: item.key,
					eventId: item.eventKey,
					eventName: event?.eventType.label ?? "",
					side: event?.side ?? "common",
					roles: item.roles ?? "",
				};
			}),
			deliverables: pkg.deliverables.map((item) => ({
				id: item.key,
				name: item.name,
				quantity: String(item.quantity),
				details: item.details ?? "",
			})),
		})),
		termsConfiguration: document.termsConfiguration ?? null,
		timelines: document.deliveryTimelines.map(({ text }) => text),
		timelineKeys: document.deliveryTimelines.map(({ key }) => key),
		terms: document.fixedTerms.map(({ text }) => text),
		termKeys: document.fixedTerms.map(({ key }) => key),
		payments: document.paymentMilestones.map((item) => ({
			id: item.key,
			label: item.label,
			percent: item.percentage,
			timing: item.timing,
		})),
	};
}

export function quotationDetailToWizardDraft(
	detail: QuoteDetail,
): QuotationDraft | null {
	if (!detail.document || detail.documentVersion !== 1) {
		return null;
	}
	return quotationDocumentToWizardDraft(detail.document, detail.expiresAt);
}
