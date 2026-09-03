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
import {
	buildQuotationSemanticModel,
	type QuotationSemanticCard,
	type QuotationSemanticModel,
	type QuotationSemanticPackage,
} from "../../semantic-model";
import type { QuotationPdfCopyProfile, QuotationPdfInput } from "../../types";
import {
	block,
	type ClassicV0Block,
	estimateTextHeight,
	labeledTextBlocks,
	packBlocks,
	plainTextBlocks,
	classicV0Styles as s,
	sectionHeadingBlock,
	subtitleBlock,
} from "./layout";

/* ── Intro blocks (eyebrow + title + metadata) ── */

function introBlocks(model: QuotationSemanticModel): ClassicV0Block[] {
	return [
		block(
			"eyebrow",
			h(Text, { style: s.eyebrow, wrap: false }, model.eyebrow),
			18,
		),
		block(
			"title",
			h(Text, { style: s.title, wrap: false }, model.title),
			38 + Math.max(0, Math.ceil(model.title.length / 32) - 1) * 26,
		),
		block(
			"metadata",
			h(
				View,
				{ style: s.metaGrid, wrap: false },
				...model.metadata.map(({ semanticId, label, value }) =>
					h(
						View,
						{ key: semanticId, style: s.metaItem },
						h(Text, { style: s.metaLabel }, label),
						h(Text, { style: s.metaValue }, value),
					),
				),
			),
			46,
		),
	];
}

/* ── Card blocks (participants / events) ── */

function cardBlocks(cards: QuotationSemanticCard[]): ClassicV0Block[] {
	return cards.flatMap((card) => [
		block(
			`${card.key}-title`,
			h(
				View,
				{ style: s.cardGroup, wrap: false },
				h(Text, { style: s.cardTitle }, card.title),
			),
			28,
			true,
		),
		...card.rows.flatMap(({ label, value, key }) =>
			labeledTextBlocks(label, value, key),
		),
	]);
}

/* ── Package blocks ── */

function packageHeaderBlock(
	item: QuotationSemanticPackage,
	copy: QuotationPdfCopyProfile,
): ClassicV0Block {
	return block(
		`${item.key}-header`,
		h(
			View,
			{ style: s.packageGroup, wrap: false },
			h(
				View,
				{
					style: {
						display: "flex",
						flexDirection: "row",
						alignItems: "baseline",
					},
				},
				h(Text, { style: s.packageName }, item.name),
				...(item.recommended
					? [
							h(
								Text,
								{ key: "badge", style: s.badge },
								copy.labels.recommended,
							),
						]
					: []),
			),
			h(Text, { style: s.price }, item.price),
		),
		38,
		true,
	);
}

function paymentTableBlocks(
	item: QuotationSemanticPackage,
	copy: QuotationPdfCopyProfile,
): ClassicV0Block[] {
	return [
		block(
			`${item.key}-payments-header`,
			h(
				View,
				{ style: s.paymentHeader, wrap: false },
				h(Text, { style: s.wideCell }, copy.labels.milestone),
				h(Text, { style: s.cell }, copy.labels.percentage),
				h(Text, { style: s.rightCell }, copy.labels.amount),
			),
			24,
			true,
		),
		...item.payments.map((payment) =>
			block(
				payment.key,
				h(
					View,
					{ style: s.paymentRow, wrap: false },
					h(Text, { style: s.wideCell }, payment.label),
					h(Text, { style: s.cell }, payment.percentage),
					h(Text, { style: s.rightCell }, payment.amount),
				),
				Math.max(28, estimateTextHeight(payment.label, 10)),
			),
		),
	];
}

function packageBlocks(
	model: QuotationSemanticModel,
	copy: QuotationPdfCopyProfile,
): ClassicV0Block[] {
	return model.packages.flatMap((item) => {
		const deliverables = item.deliverables.length
			? item.deliverables.flatMap(({ key, text }) =>
					plainTextBlocks(text, key),
				)
			: plainTextBlocks(
					copy.labels.noDeliverables,
					`${item.key}-no-deliverables`,
					true,
				);
		return [
			packageHeaderBlock(item, copy),
			...(item.summary
				? plainTextBlocks(item.summary, `${item.key}-summary`, true)
				: []),
			subtitleBlock(copy.sections.coverage, `${item.key}-coverage`),
			...item.coverage.flatMap(({ label, value, key }) =>
				labeledTextBlocks(label, value, key),
			),
			subtitleBlock(
				copy.sections.deliverables,
				`${item.key}-deliverables`,
			),
			...deliverables,
			subtitleBlock(
				copy.sections.paymentPlan,
				`${item.key}-payment-plan`,
			),
			...paymentTableBlocks(item, copy),
		];
	});
}

/* ── Clause blocks ── */

function clauseBlocks(
	items: Array<{ key: string; text: string }>,
): ClassicV0Block[] {
	return items.flatMap(({ key, text }) => plainTextBlocks(text, key));
}

/* ── Assemble all blocks ── */

function quotationBlocks(input: QuotationPdfInput): ClassicV0Block[] {
	const copy = CLASSIC_COPY_PROFILE_V1;
	const model = buildQuotationSemanticModel(input, copy);
	const blocks: ClassicV0Block[] = [
		...introBlocks(model),
		sectionHeadingBlock(copy.sections.preparedFor, "participants-heading"),
		...cardBlocks(model.participants),
		sectionHeadingBlock(copy.sections.events, "events-heading"),
		...cardBlocks(model.events),
		sectionHeadingBlock(copy.sections.packageOptions, "packages-heading"),
		...packageBlocks(model, copy),
	];
	if (model.deliveryTimelines.length) {
		blocks.push(
			sectionHeadingBlock(
				copy.sections.deliveryTimelines,
				"delivery-heading",
			),
			...clauseBlocks(model.deliveryTimelines),
		);
	}
	blocks.push(
		sectionHeadingBlock(
			copy.sections.paymentTiming,
			"payment-timing-heading",
		),
		...clauseBlocks(model.paymentTiming),
	);
	if (model.terms.length) {
		blocks.push(
			sectionHeadingBlock(copy.sections.terms, "terms-heading"),
			...clauseBlocks(model.terms),
		);
	}
	return blocks;
}

/* ── Page count ── */

export function countClassicV0QuotationPdfPages(
	input: QuotationPdfInput,
): number {
	return packBlocks(quotationBlocks(input)).length;
}

/* ── Page chrome ── */

function pageHeader(input: QuotationPdfInput) {
	return h(
		View,
		{ style: s.header, wrap: false },
		...(input.logoDataUri
			? [h(Image, { key: "logo", src: input.logoDataUri, style: s.logo })]
			: []),
		h(Text, { style: s.studioName }, input.branding.organizationName),
		h(
			Text,
			{ style: s.headerIdentity },
			`${input.quoteNumber} · v${input.quoteVersion}`,
		),
	);
}

function pageFooter(
	input: QuotationPdfInput,
	pageNumber: number,
	totalPages: number,
) {
	return h(
		View,
		{ style: s.footer, wrap: false },
		h(
			Text,
			null,
			`${input.quoteNumber} · ${input.branding.organizationName}`,
		),
		h(Text, null, `Page ${pageNumber} of ${totalPages}`),
	);
}

/* ── Document ── */

export function ClassicV0QuotationPdfDocument(
	input: QuotationPdfInput,
): ReactElement<DocumentProps> {
	const pages = packBlocks(quotationBlocks(input));
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
		...pages.map((blocks, index) => {
			const pageNumber = index + 1;
			return h(
				Page,
				{
					key: `page-${pageNumber}`,
					size: "A4",
					style: s.page,
					wrap: false,
				},
				h(
					View,
					{ style: s.pageFrame, wrap: false },
					h(
						View,
						{ style: s.pageCanvas, wrap: false },
						h(
							View,
							{ style: s.pageContent, wrap: false },
							...blocks.map(({ element }) => element),
						),
						pageHeader(input),
						pageFooter(input, pageNumber, pages.length),
					),
				),
			);
		}),
	);
}

/* ── Render with canonicalization ── */

let renderQueue: Promise<void> = Promise.resolve();

export async function renderClassicV0QuotationPdf(
	input: QuotationPdfInput,
): Promise<Buffer> {
	const rendered = renderQueue.then(() =>
		renderToBuffer(ClassicV0QuotationPdfDocument(input)),
	);
	renderQueue = rendered.then(
		() => undefined,
		() => undefined,
	);
	return canonicalizeQuotationPdf(await rendered);
}
