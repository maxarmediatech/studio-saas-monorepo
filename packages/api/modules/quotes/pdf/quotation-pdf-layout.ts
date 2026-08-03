import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";

export const PAGE_CONTENT_HEIGHT = 600;
const TEXT_LINE_HEIGHT = 14;

export const pdfStyles = StyleSheet.create({
	page: {
		width: 595.28,
		height: 841.89,
		fontFamily: "Helvetica",
		fontSize: 9.5,
		lineHeight: 1.45,
		color: "#29251f",
	},
	pageCanvas: {
		width: 595.28,
		height: 841.89,
		position: "relative",
	},
	pageContent: {
		position: "absolute",
		top: 78,
		left: 42,
		right: 42,
		height: 706,
		overflow: "hidden",
	},
	header: {
		position: "absolute",
		top: 18,
		left: 36,
		right: 36,
		height: 48,
		display: "flex",
		flexDirection: "row",
		alignItems: "center",
		borderBottomWidth: 1,
		borderBottomColor: "#ddd4c8",
		paddingHorizontal: 6,
		paddingBottom: 8,
		backgroundColor: "#ffffff",
	},
	logo: { width: 30, height: 30, objectFit: "contain", marginRight: 10 },
	studioName: {
		fontFamily: "Helvetica-Bold",
		fontSize: 11,
		color: "#191714",
	},
	footer: {
		position: "absolute",
		bottom: 16,
		left: 36,
		right: 36,
		height: 35,
		display: "flex",
		flexDirection: "row",
		justifyContent: "space-between",
		borderTopWidth: 1,
		borderTopColor: "#ddd4c8",
		paddingHorizontal: 6,
		paddingTop: 7,
		fontSize: 8,
		color: "#746a5d",
		backgroundColor: "#ffffff",
	},
	footerPage: { width: 100, textAlign: "right" },
	eyebrow: {
		fontFamily: "Helvetica-Bold",
		fontSize: 9,
		letterSpacing: 1.8,
		textTransform: "uppercase",
		color: "#a26335",
		marginBottom: 8,
	},
	title: {
		fontFamily: "Helvetica-Bold",
		fontSize: 25,
		lineHeight: 1.15,
		color: "#171512",
		marginBottom: 14,
	},
	metaGrid: { display: "flex", flexDirection: "row", marginBottom: 18 },
	metaColumn: { flex: 1, paddingRight: 12 },
	metaLabel: { fontSize: 7.5, color: "#887c6d", textTransform: "uppercase" },
	metaValue: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginTop: 2 },
	sectionTitle: {
		fontFamily: "Helvetica-Bold",
		fontSize: 13,
		color: "#171512",
		marginTop: 16,
		marginBottom: 8,
		paddingBottom: 5,
		borderBottomWidth: 1,
		borderBottomColor: "#ddd4c8",
	},
	cardFragment: {
		borderWidth: 1,
		borderColor: "#e3dbd0",
		borderRadius: 4,
		padding: 8,
		marginBottom: 2,
		backgroundColor: "#fdfbf8",
	},
	cardTitle: {
		fontFamily: "Helvetica-Bold",
		fontSize: 10.5,
		marginBottom: 3,
	},
	muted: { color: "#71685c" },
	row: { display: "flex", flexDirection: "row" },
	rowLabel: { width: 92, color: "#796f62" },
	rowValue: { flex: 1 },
	packageHeader: {
		display: "flex",
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	packageName: { fontFamily: "Helvetica-Bold", fontSize: 13 },
	price: { fontFamily: "Helvetica-Bold", fontSize: 12, color: "#91552d" },
	badge: {
		fontSize: 7,
		color: "#7d4827",
		backgroundColor: "#f4e4d6",
		paddingVertical: 2,
		paddingHorizontal: 5,
		borderRadius: 3,
		marginLeft: 7,
	},
	subtitle: { fontFamily: "Helvetica-Bold", fontSize: 9.5 },
	listItem: { paddingLeft: 8 },
	tableHeader: {
		display: "flex",
		flexDirection: "row",
		backgroundColor: "#eee8df",
		padding: 5,
		fontFamily: "Helvetica-Bold",
	},
	tableRow: {
		display: "flex",
		flexDirection: "row",
		padding: 5,
		borderBottomWidth: 1,
		borderBottomColor: "#eee8df",
	},
	wideCell: { flex: 2 },
	cell: { flex: 1 },
	rightCell: { flex: 1, textAlign: "right" },
});

export interface PdfBlock {
	key: string;
	element: ReactElement;
	estimatedHeight: number;
	keepWithNext?: boolean;
}

export function chunkPdfText(value: string, limit = 180): string[] {
	const words = value.trim().split(/\s+/).filter(Boolean);
	if (!words.length) {
		return [];
	}
	const chunks: string[] = [];
	let current = "";
	for (const word of words) {
		const pieces =
			word.length > limit
				? (word.match(new RegExp(`.{1,${limit}}`, "g")) ?? [word])
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

function textHeight(value: string, charactersPerLine: number, padding = 18) {
	return (
		padding +
		Math.max(1, Math.ceil(value.length / charactersPerLine)) *
			TEXT_LINE_HEIGHT
	);
}

export function fragmentBlock(
	children: ReactElement | ReactElement[],
	key: string,
	estimatedHeight: number,
	keepWithNext = false,
): PdfBlock {
	return {
		key,
		estimatedHeight,
		keepWithNext,
		element: h(
			View,
			{ key, style: pdfStyles.cardFragment, wrap: false },
			...(Array.isArray(children) ? children : [children]),
		),
	};
}

export function rowBlocks(
	label: string,
	value: string | null,
	key: string,
): PdfBlock[] {
	if (!value) {
		return [];
	}
	return chunkPdfText(value).map((chunk, index) =>
		fragmentBlock(
			h(
				View,
				{ style: pdfStyles.row },
				h(
					Text,
					{ style: pdfStyles.rowLabel },
					index === 0 ? label : "",
				),
				h(Text, { style: pdfStyles.rowValue }, chunk),
			),
			`${key}-${index}`,
			textHeight(chunk, 48),
		),
	);
}

export function textBlocks(
	value: string,
	key: string,
	options: { bullet?: boolean; muted?: boolean } = {},
): PdfBlock[] {
	return chunkPdfText(value).map((chunk, index) =>
		fragmentBlock(
			h(
				Text,
				{
					style: [
						pdfStyles.listItem,
						...(options.muted ? [pdfStyles.muted] : []),
					],
				},
				`${options.bullet && index === 0 ? "• " : ""}${chunk}`,
			),
			`${key}-${index}`,
			textHeight(chunk, 65),
		),
	);
}

export function headingBlock(title: string, key: string): PdfBlock {
	return {
		key,
		estimatedHeight: 44,
		keepWithNext: true,
		element: h(
			Text,
			{ key, style: pdfStyles.sectionTitle, wrap: false },
			title,
		),
	};
}

export function subtitleBlock(title: string, key: string): PdfBlock {
	return fragmentBlock(
		h(Text, { style: pdfStyles.subtitle }, title),
		key,
		34,
		true,
	);
}

export function packPdfBlocks(
	blocks: PdfBlock[],
	maximumHeight = PAGE_CONTENT_HEIGHT,
): PdfBlock[][] {
	const pages: PdfBlock[][] = [];
	let page: PdfBlock[] = [];
	let used = 0;
	for (let index = 0; index < blocks.length; index += 1) {
		const current = blocks[index];
		if (!current) {
			continue;
		}
		const following = blocks[index + 1];
		const required =
			current.estimatedHeight +
			(current.keepWithNext && following ? following.estimatedHeight : 0);
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
