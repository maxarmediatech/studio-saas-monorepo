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
import { CLASSIC_COPY_PROFILE_V1 } from "../../copy-profile";
import { canonicalizeQuotationPdf } from "../../quotation-pdf-canonical";
import { buildQuotationSemanticModel } from "../../semantic-model";
import type { QuotationPdfCopyProfile, QuotationPdfInput } from "../../types";
import {
	fragmentBlock,
	headingBlock,
	type PdfBlock,
	packPdfBlocks,
	pdfStyles,
	rowBlocks,
	subtitleBlock,
	textBlocks,
} from "./layout";

function introductoryBlocks(
	model: ReturnType<typeof buildQuotationSemanticModel>,
): PdfBlock[] {
	return [
		{
			key: "eyebrow",
			estimatedHeight: 22,
			element: h(
				Text,
				{ key: "eyebrow", style: pdfStyles.eyebrow },
				model.eyebrow,
			),
		},
		{
			key: "title",
			estimatedHeight: 45 + Math.ceil(model.title.length / 34) * 30,
			element: h(
				Text,
				{ key: "title", style: pdfStyles.title },
				model.title,
			),
		},
		{
			key: "metadata",
			estimatedHeight: 52,
			element: h(
				View,
				{ key: "metadata", style: pdfStyles.metaGrid, wrap: false },
				...model.metadata.map(({ label, value }) =>
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

function cardBlocks(
	cards: ReturnType<typeof buildQuotationSemanticModel>["participants"],
): PdfBlock[] {
	return cards.flatMap((card) => [
		fragmentBlock(
			h(Text, { style: pdfStyles.cardTitle }, card.title),
			`${card.key}-title`,
			38,
		),
		...card.rows.flatMap(({ label, value, key }) =>
			rowBlocks(label, value, key),
		),
	]);
}

function packageHeaderBlock(
	item: ReturnType<typeof buildQuotationSemanticModel>["packages"][number],
	copy: QuotationPdfCopyProfile,
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
				...(item.recommended
					? [
							h(
								Text,
								{ key: "badge", style: pdfStyles.badge },
								copy.labels.recommended,
							),
						]
					: []),
			),
			h(Text, { style: pdfStyles.price }, item.price),
		),
		`${item.key}-header`,
		44,
	);
}

function paymentTableBlocks(
	item: ReturnType<typeof buildQuotationSemanticModel>["packages"][number],
	copy: QuotationPdfCopyProfile,
): PdfBlock[] {
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
				h(Text, { style: pdfStyles.wideCell }, copy.labels.milestone),
				h(Text, { style: pdfStyles.cell }, copy.labels.percentage),
				h(Text, { style: pdfStyles.rightCell }, copy.labels.amount),
			),
		},
		...item.payments.map((payment) => ({
			key: payment.key,
			estimatedHeight: 30,
			element: h(
				View,
				{ key: payment.key, style: pdfStyles.tableRow, wrap: false },
				h(Text, { style: pdfStyles.wideCell }, payment.label),
				h(Text, { style: pdfStyles.cell }, payment.percentage),
				h(Text, { style: pdfStyles.rightCell }, payment.amount),
			),
		})),
	];
}

function packageBlocks(
	model: ReturnType<typeof buildQuotationSemanticModel>,
): PdfBlock[] {
	const copy = CLASSIC_COPY_PROFILE_V1;
	return model.packages.flatMap((item) => {
		const deliverables = item.deliverables.length
			? item.deliverables.flatMap(({ key, text }) =>
					textBlocks(text, key, { bullet: true }),
				)
			: textBlocks(
					copy.labels.noDeliverables,
					`${item.key}-no-deliverables`,
					{ muted: true },
				);
		return [
			packageHeaderBlock(item, copy),
			...(item.summary
				? textBlocks(item.summary, `${item.key}-summary`, {
						muted: true,
					})
				: []),
			subtitleBlock(copy.sections.coverage, `${item.key}-coverage-title`),
			...item.coverage.flatMap(({ label, value, key }) =>
				rowBlocks(label, value, key),
			),
			subtitleBlock(
				copy.sections.deliverables,
				`${item.key}-deliverables-title`,
			),
			...deliverables,
			subtitleBlock(
				copy.sections.paymentPlan,
				`${item.key}-payment-title`,
			),
			...paymentTableBlocks(item, copy),
		];
	});
}

function quotationBlocks(input: QuotationPdfInput): PdfBlock[] {
	const copy = CLASSIC_COPY_PROFILE_V1;
	const model = buildQuotationSemanticModel(input, copy);
	const timelines = model.deliveryTimelines.flatMap((item) =>
		textBlocks(item.text, item.key, { bullet: true }),
	);
	const timing = model.paymentTiming.flatMap((item) =>
		textBlocks(item.text, item.key, { bullet: true }),
	);
	const terms = model.terms.flatMap((item) =>
		textBlocks(item.text, item.key, { bullet: true }),
	);
	return [
		...introductoryBlocks(model),
		headingBlock(copy.sections.preparedFor, "participants-heading"),
		...cardBlocks(model.participants),
		headingBlock(copy.sections.events, "events-heading"),
		...cardBlocks(model.events),
		headingBlock(copy.sections.packageOptions, "packages-heading"),
		...packageBlocks(model),
		...(timelines.length
			? [
					headingBlock(
						copy.sections.deliveryTimelines,
						"timelines-heading",
					),
					...timelines,
				]
			: []),
		headingBlock(copy.sections.paymentTiming, "payment-timing-heading"),
		...timing,
		...(terms.length
			? [headingBlock(copy.sections.terms, "terms-heading"), ...terms]
			: []),
	];
}

export function countClassicQuotationPdfPages(
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

export function ClassicQuotationPdfDocument(
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

export async function renderClassicQuotationPdf(
	input: QuotationPdfInput,
): Promise<Buffer> {
	const rendered = renderQueue.then(() =>
		renderToBuffer(ClassicQuotationPdfDocument(input)),
	);
	renderQueue = rendered.then(
		() => undefined,
		() => undefined,
	);
	return canonicalizeQuotationPdf(await rendered);
}
