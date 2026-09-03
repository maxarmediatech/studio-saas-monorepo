import { Text, View } from "@react-pdf/renderer";
import { createElement as h } from "react";
import { CLASSIC_COPY_PROFILE_V1 } from "../../copy-profile";
import {
	buildQuotationSemanticModel,
	type QuotationSemanticCard,
	type QuotationSemanticModel,
	type QuotationSemanticPackage,
} from "../../semantic-model";
import type { QuotationPdfCopyProfile, QuotationPdfInput } from "../../types";
import {
	estimateNeutralTextHeight,
	labeledTextBlocks,
	type NeutralPdfBlock,
	neutralBlock,
	neutralStyles,
	plainTextBlocks,
	sectionHeadingBlock,
	subtitleBlock,
} from "./layout";

function groupTitleBlock(
	section: string,
	key: string,
	title: string,
	right?: string,
	badge?: string,
): NeutralPdfBlock {
	return neutralBlock(
		section,
		key,
		h(
			View,
			{ style: neutralStyles.groupTitle, wrap: false },
			h(
				View,
				{
					style: {
						display: "flex",
						flexDirection: "row",
						alignItems: "baseline",
					},
				},
				h(Text, { style: neutralStyles.groupName }, title),
				...(badge
					? [
							h(
								Text,
								{ key: "badge", style: neutralStyles.badge },
								badge,
							),
						]
					: []),
			),
			...(right
				? [h(Text, { key: "right", style: neutralStyles.price }, right)]
				: []),
		),
		42 + Math.max(0, Math.ceil(title.length / 55) - 1) * 12,
		true,
	);
}

function cardBlocks(
	section: string,
	cards: QuotationSemanticCard[],
): NeutralPdfBlock[] {
	return cards.flatMap((card) => [
		groupTitleBlock(section, `${card.key}-title`, card.title),
		...card.rows.flatMap(({ label, value, key }) =>
			labeledTextBlocks(section, label, value, key),
		),
	]);
}

function paymentBlocks(
	section: string,
	item: QuotationSemanticPackage,
	copy: QuotationPdfCopyProfile,
): NeutralPdfBlock[] {
	return [
		neutralBlock(
			section,
			`${item.key}-payments-header`,
			h(
				View,
				{ style: neutralStyles.paymentHeader, wrap: false },
				h(
					Text,
					{ style: neutralStyles.wideCell },
					copy.labels.milestone,
				),
				h(Text, { style: neutralStyles.cell }, copy.labels.percentage),
				h(Text, { style: neutralStyles.rightCell }, copy.labels.amount),
			),
			26,
			true,
		),
		...item.payments.map((payment) =>
			neutralBlock(
				section,
				payment.key,
				h(
					View,
					{ style: neutralStyles.paymentRow, wrap: false },
					h(Text, { style: neutralStyles.wideCell }, payment.label),
					h(Text, { style: neutralStyles.cell }, payment.percentage),
					h(Text, { style: neutralStyles.rightCell }, payment.amount),
				),
				Math.max(31, estimateNeutralTextHeight(payment.label, 12)),
			),
		),
	];
}

function packageBlocks(
	model: QuotationSemanticModel,
	copy: QuotationPdfCopyProfile,
): NeutralPdfBlock[] {
	const section = copy.sections.packageOptions;
	return model.packages.flatMap((item) => {
		const deliverables = item.deliverables.length
			? item.deliverables.flatMap(({ key, text }) =>
					plainTextBlocks(section, text, key),
				)
			: plainTextBlocks(
					section,
					copy.labels.noDeliverables,
					`${item.key}-no-deliverables`,
					true,
				);
		return [
			groupTitleBlock(
				section,
				`${item.key}-title`,
				item.name,
				item.price,
				item.recommended ? copy.labels.recommended : undefined,
			),
			...(item.summary
				? plainTextBlocks(
						section,
						item.summary,
						`${item.key}-summary`,
						true,
					)
				: []),
			subtitleBlock(
				section,
				copy.sections.coverage,
				`${item.key}-coverage`,
			),
			...item.coverage.flatMap(({ label, value, key }) =>
				labeledTextBlocks(section, label, value, key),
			),
			subtitleBlock(
				section,
				copy.sections.deliverables,
				`${item.key}-deliverables`,
			),
			...deliverables,
			subtitleBlock(
				section,
				copy.sections.paymentPlan,
				`${item.key}-payment-plan`,
			),
			...paymentBlocks(section, item, copy),
		];
	});
}

function clauseBlocks(
	section: string,
	items: Array<{ key: string; text: string }>,
): NeutralPdfBlock[] {
	return items.flatMap(({ key, text }) =>
		plainTextBlocks(section, text, key),
	);
}

export function neutralQuotationBlocks(
	input: QuotationPdfInput,
	copy: QuotationPdfCopyProfile = CLASSIC_COPY_PROFILE_V1,
): NeutralPdfBlock[] {
	const model = buildQuotationSemanticModel(input, copy);
	const blocks: NeutralPdfBlock[] = [
		sectionHeadingBlock(copy.sections.preparedFor, "participants-heading"),
		...cardBlocks(copy.sections.preparedFor, model.participants),
		sectionHeadingBlock(copy.sections.events, "events-heading"),
		...cardBlocks(copy.sections.events, model.events),
		sectionHeadingBlock(copy.sections.packageOptions, "packages-heading"),
		...packageBlocks(model, copy),
	];
	if (model.deliveryTimelines.length) {
		blocks.push(
			sectionHeadingBlock(
				copy.sections.deliveryTimelines,
				"delivery-heading",
			),
			...clauseBlocks(
				copy.sections.deliveryTimelines,
				model.deliveryTimelines,
			),
		);
	}
	blocks.push(
		sectionHeadingBlock(
			copy.sections.paymentTiming,
			"payment-timing-heading",
		),
		...clauseBlocks(copy.sections.paymentTiming, model.paymentTiming),
	);
	if (model.terms.length) {
		blocks.push(
			sectionHeadingBlock(copy.sections.terms, "terms-heading"),
			...clauseBlocks(copy.sections.terms, model.terms),
		);
	}
	return blocks;
}
