import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";

/**
 * Classic v0 layout engine.
 * Content area: 92pt top → 784pt bottom = 692pt usable height.
 * Margins: 44pt left/right. Header 20→72pt. Footer bottom 17pt, height 27pt.
 */
export const CLASSIC_V0_CONTENT_HEIGHT = 680;
const TEXT_LINE_HEIGHT = 11.8;
const CHARACTERS_PER_LINE = 84;

export const classicV0Styles = StyleSheet.create({
	/* ─── Page shell ─── */
	page: {
		width: 595.28,
		height: 841.89,
		position: "relative",
		fontFamily: "Helvetica",
		fontSize: 8.75,
		lineHeight: 1.38,
		color: "#1a1a1e",
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

	/* ─── Header chrome (z-index 2, opaque) ─── */
	header: {
		position: "absolute",
		top: 20,
		left: 44,
		right: 44,
		height: 48,
		zIndex: 2,
		backgroundColor: "#ffffff",
		display: "flex",
		flexDirection: "row",
		alignItems: "center",
		borderBottomWidth: 1,
		borderBottomColor: "#d4d4d8",
		paddingBottom: 8,
	},
	logo: {
		width: 28,
		height: 28,
		objectFit: "contain" as const,
		marginRight: 10,
	},
	studioName: {
		fontFamily: "Helvetica-Bold",
		fontSize: 10,
		color: "#1a1a1e",
		flex: 1,
	},
	headerIdentity: {
		fontSize: 7.5,
		color: "#71717a",
		textAlign: "right" as const,
	},

	/* ─── Footer chrome (z-index 2, opaque) ─── */
	footer: {
		position: "absolute",
		bottom: 17,
		left: 44,
		right: 44,
		height: 27,
		zIndex: 2,
		backgroundColor: "#ffffff",
		display: "flex",
		flexDirection: "row",
		justifyContent: "space-between",
		paddingTop: 7,
		borderTopWidth: 0.5,
		borderTopColor: "#d4d4d8",
		fontSize: 7.5,
		color: "#71717a",
	},

	/* ─── Content area ─── */
	pageContent: {
		position: "absolute",
		top: 82,
		left: 44,
		right: 44,
		height: 700,
		zIndex: 1,
		overflow: "hidden",
	},

	/* ─── Title block ─── */
	eyebrow: {
		fontFamily: "Helvetica-Bold",
		fontSize: 7.5,
		letterSpacing: 1.0,
		textTransform: "uppercase" as const,
		color: "#71717a",
		marginBottom: 6,
	},
	title: {
		fontFamily: "Helvetica-Bold",
		fontSize: 22,
		lineHeight: 1.15,
		color: "#1a1a1e",
		marginBottom: 14,
		maxWidth: 440,
	},

	/* ─── Metadata row ─── */
	metaGrid: {
		display: "flex",
		flexDirection: "row",
		paddingVertical: 10,
		borderTopWidth: 1,
		borderBottomWidth: 1,
		borderColor: "#d4d4d8",
		marginBottom: 16,
	},
	metaItem: { flex: 1, paddingRight: 10 },
	metaLabel: {
		fontSize: 7,
		color: "#71717a",
		marginBottom: 2,
	},
	metaValue: { fontFamily: "Helvetica-Bold", fontSize: 9 },

	/* ─── Section headings ─── */
	sectionTitle: {
		fontFamily: "Helvetica-Bold",
		fontSize: 13,
		color: "#1a1a1e",
		marginTop: 10,
		marginBottom: 8,
		paddingBottom: 5,
		borderBottomWidth: 1,
		borderBottomColor: "#1a1a1e",
	},
	subtitle: {
		fontFamily: "Helvetica-Bold",
		fontSize: 8.5,
		color: "#3f3f46",
		marginTop: 7,
		marginBottom: 3,
	},

	/* ─── Card rows (participants, events) ─── */
	cardGroup: {
		paddingTop: 7,
		paddingBottom: 6,
		borderBottomWidth: 0.5,
		borderBottomColor: "#e4e4e7",
	},
	cardTitle: {
		fontFamily: "Helvetica-Bold",
		fontSize: 10,
		marginBottom: 3,
	},
	row: {
		display: "flex",
		flexDirection: "row",
		paddingVertical: 3.5,
		borderBottomWidth: 0.5,
		borderBottomColor: "#f0f0f2",
	},
	rowLabel: { width: 80, color: "#71717a", fontSize: 8.5, paddingRight: 8 },
	rowValue: { flex: 1, fontSize: 8.75 },

	/* ─── Package header ─── */
	packageGroup: {
		display: "flex",
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "baseline",
		paddingTop: 9,
		paddingBottom: 7,
		borderBottomWidth: 1,
		borderBottomColor: "#d4d4d8",
	},
	packageName: { fontFamily: "Helvetica-Bold", fontSize: 11.5 },
	price: { fontFamily: "Helvetica-Bold", fontSize: 11, color: "#1a1a1e" },
	badge: {
		fontSize: 6.5,
		fontFamily: "Helvetica-Bold",
		color: "#52525b",
		letterSpacing: 0.5,
		marginLeft: 7,
	},

	/* ─── Text rows ─── */
	textRow: {
		paddingVertical: 4,
		borderBottomWidth: 0.5,
		borderBottomColor: "#f0f0f2",
	},
	muted: { color: "#71717a" },

	/* ─── Payment table ─── */
	paymentHeader: {
		display: "flex",
		flexDirection: "row",
		paddingVertical: 5,
		borderBottomWidth: 1,
		borderBottomColor: "#1a1a1e",
		fontFamily: "Helvetica-Bold",
		fontSize: 7.5,
		color: "#71717a",
	},
	paymentRow: {
		display: "flex",
		flexDirection: "row",
		paddingVertical: 6,
		borderBottomWidth: 0.5,
		borderBottomColor: "#e4e4e7",
	},
	wideCell: { flex: 2.5, paddingRight: 8 },
	cell: { flex: 0.7 },
	rightCell: { flex: 1, textAlign: "right" as const },
});

/* ─── Block packing types ─── */

export interface ClassicV0Block {
	key: string;
	element: ReactElement;
	estimatedHeight: number;
	keepWithNext?: boolean;
}

/* ─── Text splitting ─── */

export function splitText(value: string, limit = 500): string[] {
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

export function estimateTextHeight(value: string, base = 12): number {
	return (
		base +
		Math.max(1, Math.ceil(Array.from(value).length / CHARACTERS_PER_LINE)) *
			TEXT_LINE_HEIGHT
	);
}

/* ─── Block helpers ─── */

export function block(
	key: string,
	element: ReactElement,
	estimatedHeight: number,
	keepWithNext = false,
): ClassicV0Block {
	return { key, element, estimatedHeight, keepWithNext };
}

export function sectionHeadingBlock(
	title: string,
	key: string,
): ClassicV0Block {
	return block(
		key,
		h(Text, { style: classicV0Styles.sectionTitle, wrap: false }, title),
		38,
		true,
	);
}

export function subtitleBlock(title: string, key: string): ClassicV0Block {
	return block(
		key,
		h(Text, { style: classicV0Styles.subtitle, wrap: false }, title),
		24,
		true,
	);
}

export function labeledTextBlocks(
	label: string,
	value: string | null,
	key: string,
): ClassicV0Block[] {
	if (!value) {
		return [];
	}
	return splitText(value).map((chunk, index) =>
		block(
			`${key}-${index}`,
			h(
				View,
				{ style: classicV0Styles.row, wrap: false },
				h(
					Text,
					{ style: classicV0Styles.rowLabel },
					index === 0 ? label : "",
				),
				h(Text, { style: classicV0Styles.rowValue }, chunk),
			),
			estimateTextHeight(chunk),
		),
	);
}

export function plainTextBlocks(
	value: string,
	key: string,
	muted = false,
): ClassicV0Block[] {
	return splitText(value).map((chunk, index) =>
		block(
			`${key}-${index}`,
			h(
				Text,
				{
					style: [
						classicV0Styles.textRow,
						...(muted ? [classicV0Styles.muted] : []),
					],
					wrap: false,
				},
				chunk,
			),
			estimateTextHeight(chunk),
		),
	);
}

/* ─── Page packer ─── */

export function packBlocks(
	blocks: ClassicV0Block[],
	maximumHeight = CLASSIC_V0_CONTENT_HEIGHT,
): ClassicV0Block[][] {
	const pages: ClassicV0Block[][] = [];
	let page: ClassicV0Block[] = [];
	let used = 0;
	for (let index = 0; index < blocks.length; index += 1) {
		const current = blocks[index];
		if (!current) {
			continue;
		}
		let required = current.estimatedHeight;
		if (current.keepWithNext) {
			for (
				let lookahead = index + 1;
				lookahead < blocks.length;
				lookahead += 1
			) {
				const following = blocks[lookahead];
				if (!following) {
					break;
				}
				required += following.estimatedHeight;
				if (!following.keepWithNext) {
					break;
				}
			}
		}
		if (page.length && used + required > maximumHeight) {
			pages.push(page);
			page = [];
			used = 0;
		}
		page.push(current);
		used += current.estimatedHeight;
	}
	if (page.length) {
		pages.push(page);
	}
	return pages;
}
