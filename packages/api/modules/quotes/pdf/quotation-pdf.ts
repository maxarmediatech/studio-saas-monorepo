import {
	Document,
	type DocumentProps,
	Image,
	Page,
	renderToBuffer,
	Text,
	View,
} from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import type {
	QuotationBrandingSnapshotV1,
	QuotationDocumentV1,
} from "../../studio/schemas/quotation-document";
import { allocateMilestoneAmounts } from "../lib/quotation-document";
import { canonicalizeQuotationPdf } from "./quotation-pdf-canonical";
import {
	fragmentBlock,
	headingBlock,
	type PdfBlock,
	packPdfBlocks,
	pdfStyles,
	rowBlocks,
	subtitleBlock,
	textBlocks,
} from "./quotation-pdf-layout";

export { chunkPdfText } from "./quotation-pdf-layout";

const sideLabels = {
	common: "Common",
	bride: "Bride side",
	groom: "Groom side",
	both: "Both sides",
	separateCommon: "Separate common",
} as const;

export interface QuotationPdfInput {
	document: QuotationDocumentV1;
	branding: QuotationBrandingSnapshotV1;
	quoteNumber: string;
	quoteVersion: number;
	validUntil: string | null;
	createdAt: string;
	logoDataUri?: string;
}

function money(value: string): string {
	const [integer = "0", fraction = ""] = value.split(".");
	const grouped = new Intl.NumberFormat("en-IN", {
		maximumFractionDigits: 0,
	}).format(BigInt(integer));
	return `INR ${grouped}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

function formatDate(value: string | null): string {
	if (!value) {
		return "Not scheduled";
	}
	return new Intl.DateTimeFormat("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export function formatQuotationValidUntil(
	value: string | null,
	timeZone: string,
): string {
	if (!value) {
		return "Not scheduled";
	}
	return new Intl.DateTimeFormat("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone,
	}).format(new Date(value));
}

function introductoryBlocks(input: QuotationPdfInput): PdfBlock[] {
	const { document, branding } = input;
	return [
		{
			key: "eyebrow",
			estimatedHeight: 22,
			element: h(
				Text,
				{ key: "eyebrow", style: pdfStyles.eyebrow },
				"Quotation",
			),
		},
		{
			key: "title",
			estimatedHeight: 45 + Math.ceil(document.title.length / 34) * 30,
			element: h(
				Text,
				{ key: "title", style: pdfStyles.title },
				document.title,
			),
		},
		{
			key: "metadata",
			estimatedHeight: 52,
			element: h(
				View,
				{ key: "metadata", style: pdfStyles.metaGrid, wrap: false },
				...[
					["Quote", `${input.quoteNumber} · v${input.quoteVersion}`],
					["Quotation date", formatDate(document.quotationDate)],
					[
						"Valid until",
						formatQuotationValidUntil(
							input.validUntil,
							branding.timezone,
						),
					],
				].map(([label, value]) =>
					h(
						View,
						{ key: label, style: pdfStyles.metaColumn },
						h(Text, { style: pdfStyles.metaLabel }, label),
						h(Text, { style: pdfStyles.metaValue }, value),
					),
				),
			),
		},
	];
}

function participantBlocks(document: QuotationDocumentV1): PdfBlock[] {
	return document.participants.flatMap((participant) => [
		fragmentBlock(
			h(Text, { style: pdfStyles.cardTitle }, participant.contact.name),
			`${participant.key}-title`,
			38,
		),
		...rowBlocks(
			"Email",
			participant.contact.email,
			`${participant.key}-email`,
		),
		...rowBlocks(
			"Phone",
			participant.contact.phoneNumber,
			`${participant.key}-phone`,
		),
		...rowBlocks(
			"Address",
			participant.contact.address,
			`${participant.key}-address`,
		),
	]);
}

function eventBlocks(document: QuotationDocumentV1): PdfBlock[] {
	return document.events.flatMap((event) => [
		fragmentBlock(
			h(Text, { style: pdfStyles.cardTitle }, event.eventType.label),
			`${event.key}-title`,
			38,
		),
		...rowBlocks("Side", sideLabels[event.side], `${event.key}-side`),
		...rowBlocks("Guests", event.guestCount, `${event.key}-guests`),
		...rowBlocks(
			"Date",
			event.timelineMode === "fixed"
				? formatDate(event.fixedDate)
				: event.dateWindow,
			`${event.key}-date`,
		),
		...rowBlocks("Location", event.location, `${event.key}-location`),
		...rowBlocks("Notes", event.notes, `${event.key}-notes`),
	]);
}

function packageHeaderBlock(
	item: QuotationDocumentV1["packages"][number],
	recommendedPackageKey: string | null,
): PdfBlock {
	return fragmentBlock(
		h(
			View,
			{ style: pdfStyles.packageHeader },
			h(
				View,
				{
					style: {
						display: "flex",
						flexDirection: "row",
						alignItems: "center",
					},
				},
				h(Text, { style: pdfStyles.packageName }, item.name),
				...(item.key === recommendedPackageKey
					? [
							h(
								Text,
								{ key: "badge", style: pdfStyles.badge },
								"RECOMMENDED",
							),
						]
					: []),
			),
			h(Text, { style: pdfStyles.price }, money(item.price ?? "0")),
		),
		`${item.key}-header`,
		44,
	);
}

function paymentTableBlocks(
	item: QuotationDocumentV1["packages"][number],
	document: QuotationDocumentV1,
): PdfBlock[] {
	const amounts = new Map(
		allocateMilestoneAmounts(
			item.price ?? "0",
			document.paymentMilestones,
		).map((milestone) => [milestone.key, milestone.amount]),
	);
	const rows = document.paymentMilestones
		.filter(({ percentage }) => Number(percentage) > 0)
		.map((milestone) => ({
			key: `${item.key}-${milestone.key}`,
			estimatedHeight: 30,
			element: h(
				View,
				{
					key: `${item.key}-${milestone.key}`,
					style: pdfStyles.tableRow,
					wrap: false,
				},
				h(
					Text,
					{ style: pdfStyles.wideCell },
					`${milestone.label} — ${milestone.timing}`,
				),
				h(Text, { style: pdfStyles.cell }, `${milestone.percentage}%`),
				h(
					Text,
					{ style: pdfStyles.rightCell },
					money(amounts.get(milestone.key) ?? "0"),
				),
			),
		}));
	return [
		{
			key: `${item.key}-payment-table-header`,
			estimatedHeight: 28,
			keepWithNext: true,
			element: h(
				View,
				{
					key: `${item.key}-payment-table-header`,
					style: pdfStyles.tableHeader,
					wrap: false,
				},
				h(Text, { style: pdfStyles.wideCell }, "Milestone"),
				h(Text, { style: pdfStyles.cell }, "%"),
				h(Text, { style: pdfStyles.rightCell }, "Amount"),
			),
		},
		...rows,
	];
}

function packageBlocks(document: QuotationDocumentV1): PdfBlock[] {
	return document.packages.flatMap((item) => {
		const coverageByEvent = new Map(
			item.coverage.map((coverage) => [
				coverage.eventKey,
				coverage.roles,
			]),
		);
		const coverage = document.events.flatMap((event) =>
			rowBlocks(
				event.eventType.label,
				coverageByEvent.get(event.key) ?? "Not specified",
				`${item.key}-${event.key}-coverage`,
			),
		);
		const deliverables = item.deliverables.length
			? item.deliverables.flatMap((deliverable) =>
					textBlocks(
						`${deliverable.name} × ${deliverable.quantity}${deliverable.details ? ` — ${deliverable.details}` : ""}`,
						`${item.key}-${deliverable.key}`,
						{ bullet: true },
					),
				)
			: textBlocks(
					"No deliverables listed",
					`${item.key}-no-deliverables`,
					{
						muted: true,
					},
				);
		return [
			packageHeaderBlock(item, document.recommendedPackageKey),
			...(item.summary
				? textBlocks(item.summary, `${item.key}-summary`, {
						muted: true,
					})
				: []),
			subtitleBlock("Coverage", `${item.key}-coverage-title`),
			...coverage,
			subtitleBlock("Deliverables", `${item.key}-deliverables-title`),
			...deliverables,
			subtitleBlock("Payment plan", `${item.key}-payment-title`),
			...paymentTableBlocks(item, document),
		];
	});
}

function quotationBlocks(input: QuotationPdfInput): PdfBlock[] {
	const { document } = input;
	const timelines = document.deliveryTimelines.flatMap((item) =>
		textBlocks(item.text, item.key, { bullet: true }),
	);
	const timing = document.paymentMilestones
		.filter(({ percentage }) => Number(percentage) > 0)
		.flatMap((item) =>
			textBlocks(
				`${item.label} (${item.percentage}%) — ${item.timing}`,
				item.key,
				{
					bullet: true,
				},
			),
		);
	const terms = document.fixedTerms.flatMap((item) =>
		textBlocks(item.text, item.key, { bullet: true }),
	);
	return [
		...introductoryBlocks(input),
		headingBlock("Prepared for", "participants-heading"),
		...participantBlocks(document),
		headingBlock("Events", "events-heading"),
		...eventBlocks(document),
		headingBlock("Package options", "packages-heading"),
		...packageBlocks(document),
		...(timelines.length
			? [
					headingBlock("Delivery timelines", "timelines-heading"),
					...timelines,
				]
			: []),
		headingBlock("Payment timing", "payment-timing-heading"),
		...timing,
		...(terms.length
			? [headingBlock("Terms", "terms-heading"), ...terms]
			: []),
	];
}

export function countExplicitQuotationPdfPages(
	input: QuotationPdfInput,
): number {
	return packPdfBlocks(quotationBlocks(input)).length;
}

function pageChrome(
	input: QuotationPdfInput,
	pageNumber: number,
	totalPages: number,
) {
	return [
		h(
			View,
			{ key: "header", style: pdfStyles.header, wrap: false },
			...(input.logoDataUri
				? [
						h(Image, {
							key: "logo",
							src: input.logoDataUri,
							style: pdfStyles.logo,
						}),
					]
				: []),
			h(
				Text,
				{ style: pdfStyles.studioName },
				input.branding.organizationName,
			),
		),
		h(
			View,
			{ key: "footer", style: pdfStyles.footer, wrap: false },
			h(
				Text,
				null,
				`${input.quoteNumber} · ${input.branding.organizationName}`,
			),
			h(
				Text,
				{ style: pdfStyles.footerPage },
				`Page ${pageNumber} of ${totalPages}`,
			),
		),
	];
}

export function QuotationPdfDocument(
	input: QuotationPdfInput,
): ReactElement<DocumentProps> {
	const pages = packPdfBlocks(quotationBlocks(input));
	return h(
		Document,
		{
			title: `${input.quoteNumber} v${input.quoteVersion}`,
			author: input.branding.organizationName,
			creator: "Stuwiz Quotation Renderer",
			producer: "Stuwiz",
			creationDate: new Date(input.createdAt),
			modificationDate: new Date(input.createdAt),
		},
		...pages.map((blocks, index) =>
			h(
				Page,
				{
					key: `page-${index + 1}`,
					size: "A4",
					style: pdfStyles.page,
					wrap: false,
				},
				h(
					View,
					{ style: pdfStyles.pageCanvas, wrap: false },
					h(
						View,
						{ style: pdfStyles.pageContent, wrap: false },
						...blocks.map(({ element }) => element),
					),
					...pageChrome(input, index + 1, pages.length),
				),
			),
		),
	);
}

let renderQueue: Promise<void> = Promise.resolve();

export async function renderQuotationPdf(
	input: QuotationPdfInput,
): Promise<Buffer> {
	const rendered = renderQueue.then(() =>
		renderToBuffer(QuotationPdfDocument(input)),
	);
	renderQueue = rendered.then(
		() => undefined,
		() => undefined,
	);
	return canonicalizeQuotationPdf(await rendered);
}

export function countPdfPages(bytes: Buffer): number {
	const matches = bytes.toString("latin1").match(/\/Type\s*\/Page\b/g);
	return Math.max(1, matches?.length ?? 1);
}
