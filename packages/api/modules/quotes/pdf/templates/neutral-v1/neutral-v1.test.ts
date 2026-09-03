import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
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
	NEUTRAL_QUOTATION_TEMPLATE,
	NEUTRAL_QUOTATION_TEMPLATE_RESOURCES,
} from ".";
import {
	neutralBoundaryFixture,
	neutralMinimalFixture,
	neutralNormalFixture,
} from "./fixtures";
import { neutralStyles } from "./layout";
import {
	countNeutralQuotationPdfPages,
	renderNeutralQuotationPdf,
} from "./render";

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
				const items = content.items.flatMap((item) =>
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
					text: items.map(({ text }) => text).join(" "),
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
			const item = page.items.find(({ text }) => text === expected);
			expect(
				item,
				`${expected} must be one complete text item`,
			).toBeDefined();
			if (item) {
				expect(item.x).toBeGreaterThanOrEqual(36);
				expect(item.x + item.width).toBeLessThanOrEqual(
					page.width - 36,
				);
				expect(item.y).toBeGreaterThanOrEqual(15);
				expect(item.y + item.height).toBeLessThanOrEqual(
					page.height - 15,
				);
			}
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

const fixtureCases = [
	["minimal", neutralMinimalFixture],
	["normal", neutralNormalFixture],
	["boundary", neutralBoundaryFixture],
] as const;

describe("neutral quotation PDF template v1", () => {
	it("uses only immutable built-in fonts and no template assets", () => {
		expect(NEUTRAL_QUOTATION_TEMPLATE_RESOURCES).toEqual({
			fonts: [
				{ family: "Helvetica", source: "built-in" },
				{ family: "Helvetica-Bold", source: "built-in" },
			],
			assets: [],
		});
		expect(Object.isFrozen(NEUTRAL_QUOTATION_TEMPLATE_RESOURCES)).toBe(
			true,
		);
		expect(Object.isFrozen(NEUTRAL_QUOTATION_TEMPLATE.manifest)).toBe(true);
		expect(NEUTRAL_QUOTATION_TEMPLATE.copyProfile).toMatchObject({
			id: "classic",
			version: 1,
		});
	});

	it("pins the canvas inside a non-flexing frame and isolates opaque chrome", () => {
		expect(neutralStyles.pageFrame).toMatchObject({
			position: "relative",
			width: 595.28,
			height: 841.89,
			flexGrow: 0,
			flexShrink: 0,
		});
		expect(neutralStyles.pageCanvas).toMatchObject({
			position: "absolute",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			flexGrow: 0,
			flexShrink: 0,
		});
		expect(neutralStyles.pageContent).toMatchObject({
			position: "absolute",
			zIndex: 1,
		});
		for (const chrome of [
			neutralStyles.contentHeader,
			neutralStyles.footer,
		]) {
			expect(chrome).toMatchObject({
				position: "absolute",
				zIndex: 2,
				backgroundColor: "#ffffff",
			});
		}
	});

	it.each(fixtureCases)(
		"renders the %s fixture with semantic content and an exact explicit page count",
		async (name, fixture) => {
			const input = fixture();
			const semanticCodePoints = quotationSemanticText(
				buildQuotationSemanticModel(input),
			).reduce((total, value) => total + Array.from(value).length, 0);
			expect(semanticCodePoints).toBeLessThanOrEqual(100_000);
			if (name === "boundary") {
				expect(semanticCodePoints).toBeGreaterThanOrEqual(95_000);
			}
			const metrics = await assertQuotationPdfRenderingEnvelope(input);
			const plannedPages = countNeutralQuotationPdfPages(input);
			if (name === "boundary") {
				expect(plannedPages).toBeGreaterThanOrEqual(45);
				expect(plannedPages).toBeLessThanOrEqual(50);
			}
			const startedAt = performance.now();
			const pdf = await renderNeutralQuotationPdf(input);
			const durationMs = performance.now() - startedAt;
			const pages = await extractPdfPages(pdf);
			expect(pages).toHaveLength(plannedPages);
			expect(plannedPages).toBe(
				NEUTRAL_QUOTATION_TEMPLATE.countExplicitPages(input),
			);
			expectEveryPageChrome(pages, input);
			expect(pages[0]?.text).toContain(input.document.title);
			const extracted = normalized(
				pages.map(({ text }) => text).join(" "),
			);
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
			expect(metrics.aggregateTextCodePoints).toBeGreaterThan(0);
			if (process.env.QUOTATION_PDF_NEUTRAL_REVIEW_DIR) {
				await mkdir(process.env.QUOTATION_PDF_NEUTRAL_REVIEW_DIR, {
					recursive: true,
				});
				await writeFile(
					`${process.env.QUOTATION_PDF_NEUTRAL_REVIEW_DIR}/${name}.pdf`,
					pdf,
				);
			}
		},
		30_000,
	);

	it("renders supplied branding logo bytes", async () => {
		const logo = await sharp({
			create: {
				width: 4,
				height: 4,
				channels: 4,
				background: "#202124",
			},
		})
			.png()
			.toBuffer();
		const input = neutralMinimalFixture();
		input.logoDataUri = `data:image/png;base64,${logo.toString("base64")}`;
		input.branding = {
			...input.branding,
			logoMimeType: "image/png",
			logoSha256: createHash("sha256").update(logo).digest("hex"),
		};
		await expect(
			assertQuotationPdfRenderingEnvelope(input),
		).resolves.toMatchObject({
			logoBytes: logo.byteLength,
		});
		const pdf = await renderNeutralQuotationPdf(input);
		const { getDocument, OPS } = await import(
			"pdfjs-dist/legacy/build/pdf.mjs"
		);
		const task = getDocument({ data: new Uint8Array(pdf) });
		const document = await task.promise;
		try {
			const page = await document.getPage(1);
			const operators = await page.getOperatorList();
			expect(operators.fnArray).toContain(OPS.paintImageXObject);
		} finally {
			await document.destroy();
		}
	});

	it("renders deterministic bytes", async () => {
		const input = neutralNormalFixture();
		const first = await renderNeutralQuotationPdf(input);
		const second = await renderNeutralQuotationPdf(input);
		expect(first.equals(second)).toBe(true);
	});

	it("rejects a fixture outside the shared preflight envelope", async () => {
		const input = neutralMinimalFixture();
		input.document.participants = Array.from(
			{ length: 11 },
			(_, index) => ({
				...input.document.participants[0],
				key: `participant-${index}`,
				clientId: `client-${index}`,
			}),
		);
		await expect(
			assertQuotationPdfRenderingEnvelope(input),
		).rejects.toMatchObject({
			code: "PARTICIPANTS_LIMIT",
		});
	});
});
