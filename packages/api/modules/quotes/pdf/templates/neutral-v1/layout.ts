import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";

export const NEUTRAL_CONTENT_HEIGHT = 620;
const TEXT_LINE_HEIGHT = 11.5;
const CHARACTERS_PER_LINE = 88;

export const neutralStyles = StyleSheet.create({
	page: {
		width: 595.28,
		height: 841.89,
		position: "relative",
		fontFamily: "Helvetica",
		fontSize: 8.75,
		lineHeight: 1.35,
		color: "#202124",
		backgroundColor: "#ffffff",
	},
	pageFrame: {
		width: 595.28,
		height: 841.89,
		position: "relative",
		flexGrow: 0,
		flexShrink: 0,
	},
	pageCanvas: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		width: 595.28,
		height: 841.89,
		flexGrow: 0,
		flexShrink: 0,
	},
	cover: { position: "absolute", top: 42, left: 44, right: 44, bottom: 58 },
	coverBrand: {
		display: "flex",
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		minHeight: 58,
		paddingBottom: 18,
		borderBottomWidth: 1,
		borderBottomColor: "#d7d9dd",
	},
	coverBrandText: { maxWidth: 330 },
	logo: { maxWidth: 126, maxHeight: 48, objectFit: "contain" },
	studioName: { fontFamily: "Helvetica-Bold", fontSize: 13 },
	studioDetail: { color: "#656970", fontSize: 8, marginTop: 3 },
	coverIntro: { paddingTop: 48 },
	eyebrow: {
		fontFamily: "Helvetica-Bold",
		fontSize: 8,
		letterSpacing: 1.4,
		textTransform: "uppercase",
		color: "#656970",
		marginBottom: 12,
	},
	coverTitle: {
		fontFamily: "Helvetica-Bold",
		fontSize: 29,
		lineHeight: 1.12,
		maxWidth: 470,
		marginBottom: 26,
	},
	coverMeta: {
		display: "flex",
		flexDirection: "row",
		paddingVertical: 14,
		borderTopWidth: 1,
		borderBottomWidth: 1,
		borderColor: "#d7d9dd",
		marginBottom: 28,
	},
	metaItem: { flex: 1, paddingRight: 12 },
	metaLabel: { color: "#656970", fontSize: 7.5, marginBottom: 3 },
	metaValue: { fontFamily: "Helvetica-Bold", fontSize: 9 },
	coverLabel: {
		fontFamily: "Helvetica-Bold",
		fontSize: 7.5,
		letterSpacing: 1,
		textTransform: "uppercase",
		color: "#656970",
		marginBottom: 10,
	},
	participantGrid: {
		display: "flex",
		flexDirection: "row",
		flexWrap: "wrap",
	},
	participantName: {
		fontFamily: "Helvetica-Bold",
		fontSize: 10.5,
		lineHeight: 1.25,
		width: "50%",
		paddingRight: 12,
		marginBottom: 7,
	},
	contentHeader: {
		position: "absolute",
		top: 20,
		left: 42,
		right: 42,
		height: 52,
		zIndex: 2,
		backgroundColor: "#ffffff",
		display: "flex",
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-end",
		paddingBottom: 10,
		borderBottomWidth: 1,
		borderBottomColor: "#d7d9dd",
	},
	headerStudio: { fontFamily: "Helvetica-Bold", fontSize: 9.5 },
	headerIdentity: { color: "#656970", fontSize: 8, textAlign: "right" },
	pageContent: {
		position: "absolute",
		top: 92,
		left: 42,
		right: 42,
		height: 674,
		zIndex: 1,
	},
	pageContext: {
		fontFamily: "Helvetica-Bold",
		fontSize: 7.5,
		letterSpacing: 1,
		textTransform: "uppercase",
		color: "#656970",
		marginBottom: 12,
	},
	sectionTitle: {
		fontFamily: "Helvetica-Bold",
		fontSize: 15,
		marginTop: 5,
		marginBottom: 10,
		paddingBottom: 7,
		borderBottomWidth: 1,
		borderBottomColor: "#202124",
	},
	groupTitle: {
		display: "flex",
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "baseline",
		paddingTop: 9,
		paddingBottom: 7,
		borderBottomWidth: 1,
		borderBottomColor: "#d7d9dd",
	},
	groupName: { fontFamily: "Helvetica-Bold", fontSize: 11 },
	price: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
	badge: { fontSize: 6.5, color: "#50545a", marginLeft: 7 },
	subtitle: {
		fontFamily: "Helvetica-Bold",
		fontSize: 8.5,
		marginTop: 8,
		marginBottom: 4,
	},
	row: {
		display: "flex",
		flexDirection: "row",
		paddingVertical: 5,
		borderBottomWidth: 0.5,
		borderBottomColor: "#e7e8eb",
	},
	rowLabel: { width: 112, color: "#656970", paddingRight: 12 },
	rowValue: { flex: 1 },
	textRow: {
		paddingVertical: 5,
		borderBottomWidth: 0.5,
		borderBottomColor: "#e7e8eb",
	},
	muted: { color: "#656970" },
	paymentHeader: {
		display: "flex",
		flexDirection: "row",
		paddingVertical: 6,
		borderBottomWidth: 1,
		borderBottomColor: "#202124",
		fontFamily: "Helvetica-Bold",
		fontSize: 7.5,
		color: "#656970",
	},
	paymentRow: {
		display: "flex",
		flexDirection: "row",
		paddingVertical: 7,
		borderBottomWidth: 0.5,
		borderBottomColor: "#d7d9dd",
	},
	wideCell: { flex: 2.4, paddingRight: 10 },
	cell: { flex: 0.7 },
	rightCell: { flex: 1, textAlign: "right" },
	footer: {
		position: "absolute",
		bottom: 17,
		left: 42,
		right: 42,
		height: 27,
		zIndex: 2,
		backgroundColor: "#ffffff",
		display: "flex",
		flexDirection: "row",
		justifyContent: "space-between",
		paddingTop: 7,
		borderTopWidth: 0.5,
		borderTopColor: "#d7d9dd",
		fontSize: 7.5,
		color: "#656970",
	},
});

export interface NeutralPdfBlock {
	key: string;
	section: string;
	element: ReactElement;
	estimatedHeight: number;
	keepWithNext?: boolean;
}

export interface NeutralPdfPagePlan {
	section: string;
	blocks: NeutralPdfBlock[];
}

export function splitNeutralText(value: string, limit = 500): string[] {
	const words = value.trim().split(/\s+/).filter(Boolean);
	const chunks: string[] = [];
	let current = "";
	for (const word of words) {
		const pieces =
			word.length > limit
				? (word.match(new RegExp(`.{1,${limit}}`, "gu")) ?? [word])
				: [word];
		for (const piece of pieces) {
			if (!current) {
				current = piece;
			} else if (current.length + piece.length + 1 <= limit) {
				current += ` ${piece}`;
			} else {
				chunks.push(current);
				current = piece;
			}
		}
	}
	if (current) {
		chunks.push(current);
	}
	return chunks;
}

export function estimateNeutralTextHeight(value: string, base = 13): number {
	return (
		base +
		Math.max(1, Math.ceil(Array.from(value).length / CHARACTERS_PER_LINE)) *
			TEXT_LINE_HEIGHT
	);
}

export function neutralBlock(
	section: string,
	key: string,
	element: ReactElement,
	estimatedHeight: number,
	keepWithNext = false,
): NeutralPdfBlock {
	return { section, key, element, estimatedHeight, keepWithNext };
}

export function packNeutralPdfBlocks(
	blocks: NeutralPdfBlock[],
	maximumHeight = NEUTRAL_CONTENT_HEIGHT,
): NeutralPdfPagePlan[] {
	const pages: NeutralPdfPagePlan[] = [];
	let page: NeutralPdfBlock[] = [];
	let used = 0;
	for (let index = 0; index < blocks.length; index += 1) {
		const block = blocks[index];
		if (!block) {
			continue;
		}
		const next = blocks[index + 1];
		const required =
			block.estimatedHeight +
			(block.keepWithNext && next ? next.estimatedHeight : 0);
		if (page.length && used + required > maximumHeight) {
			pages.push({
				section: page[0]?.section ?? block.section,
				blocks: page,
			});
			page = [];
			used = 0;
		}
		page.push(block);
		used += block.estimatedHeight;
	}
	if (page.length) {
		pages.push({ section: page[0]?.section ?? "", blocks: page });
	}
	return pages;
}

export const sectionHeadingBlock = (section: string, key: string) =>
	neutralBlock(
		section,
		key,
		h(Text, { style: neutralStyles.sectionTitle, wrap: false }, section),
		43,
		true,
	);

export const subtitleBlock = (section: string, title: string, key: string) =>
	neutralBlock(
		section,
		key,
		h(Text, { style: neutralStyles.subtitle, wrap: false }, title),
		27,
		true,
	);

export function labeledTextBlocks(
	section: string,
	label: string,
	value: string | null,
	key: string,
): NeutralPdfBlock[] {
	if (!value) {
		return [];
	}
	return splitNeutralText(value).map((chunk, index) =>
		neutralBlock(
			section,
			`${key}-${index}`,
			h(
				View,
				{ style: neutralStyles.row, wrap: false },
				h(
					Text,
					{ style: neutralStyles.rowLabel },
					index === 0 ? label : "",
				),
				h(Text, { style: neutralStyles.rowValue }, chunk),
			),
			estimateNeutralTextHeight(chunk),
		),
	);
}

export function plainTextBlocks(
	section: string,
	value: string,
	key: string,
	muted = false,
): NeutralPdfBlock[] {
	return splitNeutralText(value).map((chunk, index) =>
		neutralBlock(
			section,
			`${key}-${index}`,
			h(
				Text,
				{
					style: [
						neutralStyles.textRow,
						...(muted ? [neutralStyles.muted] : []),
					],
					wrap: false,
				},
				chunk,
			),
			estimateNeutralTextHeight(chunk),
		),
	);
}
