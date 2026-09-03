import { mkdir, writeFile } from "node:fs/promises";
import { Text } from "@react-pdf/renderer";
import { createElement as h } from "react";
import { describe, expect, it } from "vitest";
import {
	assertQuotationPdfOutputEnvelope,
	assertQuotationPdfRenderingEnvelope,
} from "../../preflight";
import {
	buildQuotationSemanticModel,
	quotationSemanticText,
} from "../../semantic-model";
import type { QuotationPdfInput } from "../../types";
import {
	neutralMinimalFixture,
	neutralNormalFixture,
} from "../neutral-v1/fixtures";
import {
	CLASSIC_V0_QUOTATION_RESOURCES,
	CLASSIC_V0_QUOTATION_TEMPLATE,
} from ".";
import { block, classicV0Styles, packBlocks } from "./layout";
import {
	countClassicV0QuotationPdfPages,
	renderClassicV0QuotationPdf,
} from "./render";

/* ── Helpers ── */

interface ExtractedPdfTextItem {
	text: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

interface ExtractedPdfPage {
	text: string;
	items: ExtractedPdfTextItem[];
	width: number;
	height: number;
}

async function extractPdfPages(bytes: Buffer): Promise<ExtractedPdfPage[]> {
	const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
	const task = getDocument({ data: new Uint8Array(bytes) });
	const pdf = await task.promise;
	try {
		return await Promise.all(
			Array.from({ length: pdf.numPages }, async (_, index) => {
				const page = await pdf.getPage(index + 1);
				const content = await page.getTextContent();
				const viewport = page.getViewport({ scale: 1 });
				const items = content.items.flatMap((item: any) =>
					"str" in item
						? [
								{
									text: item.str,
									x: item.transform[4] ?? 0,
									y: item.transform[5] ?? 0,
									width: item.width,
									height: item.height,
								},
							]
						: [],
				);
				return {
					text: items.map(({ text }: any) => text).join(" "),
					items,
					width: viewport.width,
					height: viewport.height,
				};
			}),
		);
	} finally {
		await pdf.destroy();
	}
}

function expectEveryPageChrome(
	pages: ExtractedPdfPage[],
	input: QuotationPdfInput,
): void {
	const quoteIdentity = `${input.quoteNumber} · v${input.quoteVersion}`;
	for (const [index, page] of pages.entries()) {
		const pageIdentity = `Page ${index + 1} of ${pages.length}`;
		for (const expected of [
			input.branding.organizationName,
			quoteIdentity,
			pageIdentity,
		]) {
			expect(page.text).toContain(expected);
		}
	}
}

function normalized(value: string): string {
	return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

function semanticMarker(value: string): string {
	const result = normalized(value);
	return result.length > 72 ? result.slice(0, 36).trimEnd() : result;
}

/* ── Tests ── */

describe("classic quotation PDF template v0", () => {
	it("uses only immutable built-in fonts and no template assets", () => {
		expect(CLASSIC_V0_QUOTATION_RESOURCES).toEqual({
			fonts: [
				{ family: "Helvetica", source: "built-in" },
				{ family: "Helvetica-Bold", source: "built-in" },
			],
			assets: [],
		});
		expect(Object.isFrozen(CLASSIC_V0_QUOTATION_RESOURCES)).toBe(true);
		expect(Object.isFrozen(CLASSIC_V0_QUOTATION_TEMPLATE.manifest)).toBe(
			true,
		);
		expect(CLASSIC_V0_QUOTATION_TEMPLATE.copyProfile).toMatchObject({
			id: "classic",
			version: 1,
		});
	});

	it("declares template identity as classic version 2", () => {
		expect(CLASSIC_V0_QUOTATION_TEMPLATE.manifest).toMatchObject({
			id: "classic",
			version: 2,
			label: "Classic v0",
			status: "active",
		});
	});

	it("pins the canvas inside a non-flexing frame", () => {
		expect(classicV0Styles.pageFrame).toMatchObject({
			position: "relative",
			width: 595.28,
			height: 841.89,
			flexGrow: 0,
			flexShrink: 0,
		});
		expect(classicV0Styles.pageCanvas).toMatchObject({
			position: "absolute",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			flexGrow: 0,
			flexShrink: 0,
		});
		expect(classicV0Styles.pageContent).toMatchObject({
			position: "absolute",
			zIndex: 1,
		});
		for (const chrome of [classicV0Styles.header, classicV0Styles.footer]) {
			expect(chrome).toMatchObject({
				position: "absolute",
				zIndex: 2,
				backgroundColor: "#ffffff",
			});
		}
	});

	it("keeps chained headings with the first content row", () => {
		const packed = packBlocks(
			[
				block("page-content", h(Text, null, "Content"), 650),
				block("subtitle", h(Text, null, "Payment plan"), 20, true),
				block("table-header", h(Text, null, "Milestone"), 20, true),
				block("first-row", h(Text, null, "Advance"), 20),
			],
			680,
		);

		expect(packed.map((page) => page.map(({ key }) => key))).toEqual([
			["page-content"],
			["subtitle", "table-header", "first-row"],
		]);
	});

	it("renders the minimal fixture with correct page count and chrome", async () => {
		const input = neutralMinimalFixture();
		const plannedPages = countClassicV0QuotationPdfPages(input);
		expect(plannedPages).toBeGreaterThanOrEqual(1);
		const pdf = await renderClassicV0QuotationPdf(input);
		const pages = await extractPdfPages(pdf);
		expect(pages).toHaveLength(plannedPages);
		expect(plannedPages).toBe(
			CLASSIC_V0_QUOTATION_TEMPLATE.countExplicitPages(input),
		);
		expectEveryPageChrome(pages, input);
		expect(pages[0]?.text).toContain(input.document.title);
		if (process.env.QUOTATION_PDF_CLASSIC_V0_REVIEW_DIR) {
			await mkdir(process.env.QUOTATION_PDF_CLASSIC_V0_REVIEW_DIR, {
				recursive: true,
			});
			await writeFile(
				`${process.env.QUOTATION_PDF_CLASSIC_V0_REVIEW_DIR}/minimal.pdf`,
				pdf,
			);
		}
	}, 15_000);

	it("renders the normal fixture with semantic content preservation", async () => {
		const input = neutralNormalFixture();
		await assertQuotationPdfRenderingEnvelope(input);
		const plannedPages = countClassicV0QuotationPdfPages(input);
		const startedAt = performance.now();
		const pdf = await renderClassicV0QuotationPdf(input);
		const durationMs = performance.now() - startedAt;
		const pages = await extractPdfPages(pdf);
		expect(pages).toHaveLength(plannedPages);
		expectEveryPageChrome(pages, input);
		const extracted = normalized(pages.map(({ text }) => text).join(" "));
		for (const value of quotationSemanticText(
			buildQuotationSemanticModel(input),
		)) {
			const marker = semanticMarker(value);
			if (marker) {
				expect(extracted).toContain(marker);
			}
		}
		assertQuotationPdfOutputEnvelope({
			pageCount: pages.length,
			durationMs,
			byteSize: pdf.byteLength,
		});
		if (process.env.QUOTATION_PDF_CLASSIC_V0_REVIEW_DIR) {
			await mkdir(process.env.QUOTATION_PDF_CLASSIC_V0_REVIEW_DIR, {
				recursive: true,
			});
			await writeFile(
				`${process.env.QUOTATION_PDF_CLASSIC_V0_REVIEW_DIR}/normal.pdf`,
				pdf,
			);
		}
	}, 30_000);

	it("renders deterministic bytes", async () => {
		const input = neutralMinimalFixture();
		const first = await renderClassicV0QuotationPdf(input);
		const second = await renderClassicV0QuotationPdf(input);
		expect(first.equals(second)).toBe(true);
	}, 15_000);
});
