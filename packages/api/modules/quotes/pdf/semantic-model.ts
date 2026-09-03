import { allocateMilestoneAmounts } from "../lib/quotation-document";
import { CLASSIC_COPY_PROFILE_V1 } from "./copy-profile";
import {
	formatQuotationDate,
	formatQuotationMoney,
	formatQuotationValidUntil,
	QUOTATION_EVENT_SIDE_LABELS,
} from "./formatting";
import type { QuotationPdfCopyProfile, QuotationPdfInput } from "./types";

export interface QuotationSemanticRow {
	key: string;
	semanticId: string;
	label: string;
	value: string | null;
}

export interface QuotationSemanticCard {
	key: string;
	titleSemanticId: string;
	title: string;
	rows: QuotationSemanticRow[];
}

export interface QuotationSemanticPackage {
	key: string;
	nameSemanticId: string;
	name: string;
	priceSemanticId: string;
	price: string;
	recommended: boolean;
	summary: string | null;
	coverage: QuotationSemanticRow[];
	deliverables: Array<{ key: string; semanticId: string; text: string }>;
	payments: Array<{
		key: string;
		semanticId: string;
		label: string;
		percentage: string;
		amount: string;
	}>;
}

export interface QuotationSemanticModel {
	eyebrow: string;
	titleSemanticId: "quote.title";
	title: string;
	metadata: Array<{ semanticId: string; label: string; value: string }>;
	participants: QuotationSemanticCard[];
	events: QuotationSemanticCard[];
	packages: QuotationSemanticPackage[];
	deliveryTimelines: Array<{
		key: string;
		semanticId: string;
		text: string;
	}>;
	paymentTiming: Array<{ key: string; semanticId: string; text: string }>;
	terms: Array<{ key: string; semanticId: string; text: string }>;
}

export function buildQuotationSemanticModel(
	input: QuotationPdfInput,
	copy: QuotationPdfCopyProfile = CLASSIC_COPY_PROFILE_V1,
): QuotationSemanticModel {
	const { document, branding } = input;
	return {
		eyebrow: copy.sections.quotation,
		titleSemanticId: "quote.title",
		title: document.title,
		metadata: [
			{
				semanticId: "quote.number",
				label: copy.metadata.quote,
				value: `${input.quoteNumber} · v${input.quoteVersion}`,
			},
			{
				semanticId: "quote.date",
				label: copy.metadata.quotationDate,
				value: formatQuotationDate(
					document.quotationDate,
					copy.labels.notScheduled,
				),
			},
			{
				semanticId: "quote.validUntil",
				label: copy.metadata.validUntil,
				value: formatQuotationValidUntil(
					input.validUntil,
					branding.timezone,
					copy.labels.notScheduled,
				),
			},
		],
		participants: document.participants.map((participant) => ({
			key: participant.key,
			titleSemanticId: `participant.${participant.key}.name`,
			title: participant.contact.name,
			rows: [
				{
					key: `${participant.key}-email`,
					semanticId: `participant.${participant.key}.email`,
					label: copy.labels.email,
					value: participant.contact.email,
				},
				{
					key: `${participant.key}-phone`,
					semanticId: `participant.${participant.key}.phone`,
					label: copy.labels.phone,
					value: participant.contact.phoneNumber,
				},
				{
					key: `${participant.key}-address`,
					semanticId: `participant.${participant.key}.address`,
					label: copy.labels.address,
					value: participant.contact.address,
				},
			],
		})),
		events: document.events.map((event) => ({
			key: event.key,
			titleSemanticId: `event.${event.key}.type`,
			title: event.eventType.label,
			rows: [
				{
					key: `${event.key}-side`,
					semanticId: `event.${event.key}.side`,
					label: copy.labels.side,
					value: QUOTATION_EVENT_SIDE_LABELS[event.side],
				},
				{
					key: `${event.key}-guests`,
					semanticId: `event.${event.key}.guests`,
					label: copy.labels.guests,
					value: event.guestCount,
				},
				{
					key: `${event.key}-date`,
					semanticId: `event.${event.key}.date`,
					label: copy.labels.date,
					value:
						event.timelineMode === "fixed"
							? formatQuotationDate(
									event.fixedDate,
									copy.labels.notScheduled,
								)
							: event.dateWindow,
				},
				{
					key: `${event.key}-location`,
					semanticId: `event.${event.key}.location`,
					label: copy.labels.location,
					value: event.location,
				},
				{
					key: `${event.key}-notes`,
					semanticId: `event.${event.key}.notes`,
					label: copy.labels.notes,
					value: event.notes,
				},
			],
		})),
		packages: document.packages.map((item) => {
			const coverageByEvent = new Map(
				item.coverage.map((coverage) => [coverage.eventKey, coverage]),
			);
			const amounts = new Map(
				allocateMilestoneAmounts(
					item.price ?? "0",
					document.paymentMilestones,
				).map((milestone) => [milestone.key, milestone.amount]),
			);
			return {
				key: item.key,
				nameSemanticId: `package.${item.key}.name`,
				name: item.name,
				priceSemanticId: `package.${item.key}.price`,
				price: formatQuotationMoney(item.price ?? "0"),
				recommended: item.key === document.recommendedPackageKey,
				summary: item.summary,
				coverage: document.events.map((event) => {
					const sourceCoverage = coverageByEvent.get(event.key);
					return {
						key: `${item.key}-${event.key}-coverage`,
						semanticId: sourceCoverage
							? `package.${item.key}.coverage.${sourceCoverage.key}`
							: `package.${item.key}.coverage-missing.event.${event.key}`,
						label: event.eventType.label,
						value:
							sourceCoverage?.roles ?? copy.labels.notSpecified,
					};
				}),
				deliverables: item.deliverables.map((deliverable) => ({
					key: `${item.key}-${deliverable.key}`,
					semanticId: `package.${item.key}.deliverable.${deliverable.key}`,
					text: `${deliverable.name} × ${deliverable.quantity}${deliverable.details ? ` — ${deliverable.details}` : ""}`,
				})),
				payments: document.paymentMilestones
					.filter(({ percentage }) => Number(percentage) > 0)
					.map((milestone) => ({
						key: `${item.key}-${milestone.key}`,
						semanticId: `payment.${milestone.key}.timing`,
						label: `${milestone.label} — ${milestone.timing}`,
						percentage: `${milestone.percentage}%`,
						amount: formatQuotationMoney(
							amounts.get(milestone.key) ?? "0",
						),
					})),
			};
		}),
		deliveryTimelines: document.deliveryTimelines.map((item) => ({
			...item,
			semanticId: `delivery.${item.key}.text`,
		})),
		paymentTiming: document.paymentMilestones
			.filter(({ percentage }) => Number(percentage) > 0)
			.map((item) => ({
				key: item.key,
				semanticId: `payment.${item.key}.timing`,
				text: `${item.label} (${item.percentage}%) — ${item.timing}`,
			})),
		terms: document.fixedTerms.map((item) => ({
			...item,
			semanticId: `term.${item.key}.text`,
		})),
	};
}

export function quotationSemanticText(model: QuotationSemanticModel): string[] {
	return [
		model.eyebrow,
		model.title,
		...model.metadata.flatMap(({ label, value }) => [label, value]),
		...model.participants.flatMap((card) => [
			card.title,
			...card.rows.flatMap(({ label, value }) =>
				value ? [label, value] : [],
			),
		]),
		...model.events.flatMap((card) => [
			card.title,
			...card.rows.flatMap(({ label, value }) =>
				value ? [label, value] : [],
			),
		]),
		...model.packages.flatMap((item) => [
			item.name,
			item.price,
			...(item.summary ? [item.summary] : []),
			...item.coverage.flatMap(({ label, value }) =>
				value ? [label, value] : [],
			),
			...item.deliverables.map(({ text }) => text),
			...item.payments.flatMap(({ label, percentage, amount }) => [
				label,
				percentage,
				amount,
			]),
		]),
		...model.deliveryTimelines.map(({ text }) => text),
		...model.paymentTiming.map(({ text }) => text),
		...model.terms.map(({ text }) => text),
	];
}
