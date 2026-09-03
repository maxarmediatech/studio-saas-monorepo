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
import type { QuotationPdfInput } from "../../types";
import { neutralQuotationBlocks } from "./blocks";
import { neutralStyles, packNeutralPdfBlocks } from "./layout";

function documentMetadata(input: QuotationPdfInput): DocumentProps {
	return {
		title: `${input.quoteNumber} v${input.quoteVersion}`,
		author: input.branding.organizationName,
		creator: "Stuwiz Quotation Renderer",
		producer: "Stuwiz",
		creationDate: new Date(input.createdAt),
		modificationDate: new Date(input.createdAt),
	};
}

function pageFrame(...children: ReactElement[]) {
	return h(
		View,
		{ style: neutralStyles.pageFrame, wrap: false },
		h(View, { style: neutralStyles.pageCanvas, wrap: false }, ...children),
	);
}

function footer(
	input: QuotationPdfInput,
	pageNumber: number,
	totalPages: number,
) {
	return h(
		View,
		{ style: neutralStyles.footer, wrap: false },
		h(
			Text,
			null,
			`${input.quoteNumber} · ${input.branding.organizationName}`,
		),
		h(Text, null, `Page ${pageNumber} of ${totalPages}`),
	);
}

function brandingDetails(input: QuotationPdfInput): string[] {
	return [
		input.branding.address,
		input.branding.email,
		input.branding.phone,
	].filter((value): value is string => Boolean(value));
}

function coverPage(input: QuotationPdfInput, totalPages: number) {
	const copy = CLASSIC_COPY_PROFILE_V1;
	const model = buildQuotationSemanticModel(input, copy);
	return h(
		Page,
		{ key: "cover", size: "A4", style: neutralStyles.page, wrap: false },
		pageFrame(
			h(
				View,
				{ style: neutralStyles.cover, wrap: false },
				h(
					View,
					{ style: neutralStyles.coverBrand, wrap: false },
					h(
						View,
						{ style: neutralStyles.coverBrandText },
						h(
							Text,
							{ style: neutralStyles.studioName },
							input.branding.organizationName,
						),
						...brandingDetails(input).map((detail, index) =>
							h(
								Text,
								{
									key: `brand-${index}`,
									style: neutralStyles.studioDetail,
								},
								detail,
							),
						),
					),
					...(input.logoDataUri
						? [
								h(Image, {
									key: "logo",
									src: input.logoDataUri,
									style: neutralStyles.logo,
								}),
							]
						: []),
				),
				h(
					View,
					{ style: neutralStyles.coverIntro },
					h(Text, { style: neutralStyles.eyebrow }, model.eyebrow),
					h(Text, { style: neutralStyles.coverTitle }, model.title),
					h(
						View,
						{ style: neutralStyles.coverMeta, wrap: false },
						...model.metadata.map(({ semanticId, label, value }) =>
							h(
								View,
								{
									key: semanticId,
									style: neutralStyles.metaItem,
								},
								h(
									Text,
									{ style: neutralStyles.metaLabel },
									label,
								),
								h(
									Text,
									{ style: neutralStyles.metaValue },
									value,
								),
							),
						),
					),
					h(
						Text,
						{ style: neutralStyles.coverLabel },
						copy.sections.preparedFor,
					),
					h(
						View,
						{ style: neutralStyles.participantGrid, wrap: false },
						...model.participants.map((participant) =>
							h(
								Text,
								{
									key: participant.key,
									style: neutralStyles.participantName,
								},
								participant.title,
							),
						),
					),
				),
			),
			footer(input, 1, totalPages),
		),
	);
}

function contentHeader(input: QuotationPdfInput) {
	return h(
		View,
		{ style: neutralStyles.contentHeader, wrap: false },
		h(
			Text,
			{ style: neutralStyles.headerStudio },
			input.branding.organizationName,
		),
		h(
			Text,
			{ style: neutralStyles.headerIdentity },
			`${input.quoteNumber} · v${input.quoteVersion}`,
		),
	);
}

export function NeutralQuotationPdfDocument(
	input: QuotationPdfInput,
): ReactElement<DocumentProps> {
	const contentPages = packNeutralPdfBlocks(neutralQuotationBlocks(input));
	const totalPages = 1 + contentPages.length;
	return h(
		Document,
		documentMetadata(input),
		coverPage(input, totalPages),
		...contentPages.map((plan, index) => {
			const pageNumber = index + 2;
			return h(
				Page,
				{
					key: `page-${pageNumber}`,
					size: "A4",
					style: neutralStyles.page,
					wrap: false,
				},
				pageFrame(
					h(
						View,
						{ style: neutralStyles.pageContent, wrap: false },
						h(
							Text,
							{ style: neutralStyles.pageContext },
							plan.section,
						),
						...plan.blocks.map(({ element }) => element),
					),
					contentHeader(input),
					footer(input, pageNumber, totalPages),
				),
			);
		}),
	);
}

export function countNeutralQuotationPdfPages(
	input: QuotationPdfInput,
): number {
	return 1 + packNeutralPdfBlocks(neutralQuotationBlocks(input)).length;
}

let renderQueue: Promise<void> = Promise.resolve();

export async function renderNeutralQuotationPdf(
	input: QuotationPdfInput,
): Promise<Buffer> {
	const rendered = renderQueue.then(() =>
		renderToBuffer(NeutralQuotationPdfDocument(input)),
	);
	renderQueue = rendered.then(
		() => undefined,
		() => undefined,
	);
	return canonicalizeQuotationPdf(await rendered);
}
