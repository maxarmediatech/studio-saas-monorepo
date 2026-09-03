import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { QuotationDocumentV1 } from "../../studio/schemas/quotation-document";
import {
	countExplicitQuotationPdfPages,
	countPdfPages,
	formatQuotationValidUntil,
	renderQuotationPdf,
} from "./quotation-pdf";

const documentFixture = (): QuotationDocumentV1 => ({
	schemaVersion: 1,
	quotationDate: "2026-08-03",
	quotationType: { id: "type-1", key: "wedding", label: "Wedding" },
	title: "A and B - Wedding quotation",
	currency: "INR",
	participants: [
		{
			key: "participant-1",
			clientId: "client-1",
			clientUpdatedAt: "2026-08-03T10:00:00.000Z",
			contact: {
				name: "A",
				email: null,
				phoneNumber: null,
				alternatePhone: null,
				address: null,
				profession: null,
				source: null,
				socialHandle: null,
				notes: null,
			},
		},
	],
	events: [
		{
			key: "event-1",
			eventType: {
				id: "event-type-1",
				key: "ceremony",
				label: "Ceremony",
			},
			side: "bride",
			guestCount: "200",
			timelineMode: "fixed",
			fixedDate: "2026-12-10",
			dateWindow: null,
			location: "Jaipur",
			notes: null,
		},
	],
	packages: [
		{
			key: "package-1",
			configuration: null,
			name: "Classic",
			price: "1000.01",
			summary: null,
			coverage: [
				{
					key: "coverage-1",
					eventKey: "event-1",
					roles: "2 photographers",
				},
			],
			deliverables: [
				{
					key: "deliverable-1",
					name: "Album",
					quantity: 1,
					details: null,
				},
			],
		},
	],
	recommendedPackageKey: "package-1",
	deliveryTimelines: [],
	paymentMilestones: [
		{
			key: "payment-1",
			label: "Advance",
			percentage: "33.33",
			timing: "Booking",
		},
		{
			key: "payment-2",
			label: "Second",
			percentage: "33.33",
			timing: "Event",
		},
		{
			key: "payment-3",
			label: "Final",
			percentage: "33.34",
			timing: "Delivery",
		},
	],
	fixedTerms: [],
});

const branding = {
	schemaVersion: 1 as const,
	organizationName: "Studio Test",
	address: "Bhubaneswar",
	email: "hello@example.invalid",
	phone: null,
	taxIdentifier: null,
	timezone: "Asia/Kolkata",
	logoStorageKey: null,
	logoMimeType: null,
	logoSha256: null,
};

async function extractPdfPages(bytes: Buffer) {
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
								},
							]
						: [],
				);
				return {
					text: items.map((item) => item.text).join(" "),
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

function expectPageChrome(
	pages: Awaited<ReturnType<typeof extractPdfPages>>,
	quoteNumber: string,
) {
	for (const [index, page] of pages.entries()) {
		expect(page.text.match(/Studio Test/g)?.length).toBeGreaterThanOrEqual(
			2,
		);
		expect(page.text).toContain(`Page ${index + 1} of ${pages.length}`);
		const header = page.items.find(
			(item) => item.text === "Studio Test" && item.y > 760,
		);
		const footerQuote = page.items.find(
			(item) => item.text.includes(quoteNumber) && item.y < 50,
		);
		const footerPage = page.items.find(
			(item) =>
				item.text.includes(`Page ${index + 1} of ${pages.length}`) &&
				item.y < 50,
		);
		expect(header?.y).toBeGreaterThan(760);
		expect(header?.y).toBeLessThan(820);
		expect(header?.x).toBeGreaterThanOrEqual(36);
		expect(footerQuote?.y).toBeGreaterThan(15);
		expect(footerQuote?.y).toBeLessThan(50);
		expect(footerQuote?.x).toBeGreaterThanOrEqual(36);
		expect(footerPage?.y).toBeGreaterThan(15);
		expect(footerPage?.y).toBeLessThan(50);
		expect(page.width).toBeCloseTo(595.28, 1);
		expect(page.height).toBeCloseTo(841.89, 1);
	}
}

describe("quotation PDF", () => {
	it("formats the validity instant in the studio timezone", () => {
		expect(
			formatQuotationValidUntil(
				"2026-08-18T03:59:59.999Z",
				"America/New_York",
			),
		).toBe("17 Aug 2026");
		expect(
			formatQuotationValidUntil(
				"2026-08-17T18:29:59.999Z",
				"Asia/Kolkata",
			),
		).toBe("17 Aug 2026");
	});
	it("renders stable paginated PDF bytes without a logo", async () => {
		const input = {
			document: {
				...documentFixture(),
				fixedTerms: Array.from({ length: 24 }, (_, index) => ({
					key: `term-${index}`,
					text: `Term ${index + 1}: The studio and client will coordinate approvals, travel, access, and delivery feedback within the agreed quotation timeline.`,
				})),
			},
			branding,
			quoteNumber: "QT-2026-0001",
			quoteVersion: 1,
			validUntil: "2026-08-17T18:29:59.999Z",
			createdAt: "2026-08-03T10:00:00.000Z",
		};
		const [first, second] = await Promise.all([
			renderQuotationPdf(input),
			renderQuotationPdf(input),
		]);
		if (process.env.QUOTATION_PDF_ARTIFACT) {
			await mkdir("../../output/pdf", { recursive: true });
			await writeFile(
				"../../output/pdf/quotation-system-fixture.pdf",
				first,
			);
		}
		expect(createHash("sha256").update(first).digest("hex")).toBe(
			"f77bec68c86494d3abb536a5fd2e9ea6a7d2edcea0d82d2254bcd18d54a1a259",
		);
		expect(countPdfPages(first)).toBe(5);
		expect(first.byteLength).toBe(23_377);
		expect(first.subarray(0, 4).toString()).toBe("%PDF");
		expect(countPdfPages(first)).toBeGreaterThanOrEqual(1);
		expect(createHash("sha256").update(first).digest("hex")).toBe(
			createHash("sha256").update(second).digest("hex"),
		);
		const pages = await extractPdfPages(first);
		expect(pages).toHaveLength(countExplicitQuotationPdfPages(input));
		expectPageChrome(pages, input.quoteNumber);
		const text = pages.map((page) => page.text).join(" ");
		expect(text).toContain("INR 1,000.01");
		expect(text).toContain("INR 333.30");
		expect(text).toContain("INR 333.41");
		const timingPage = pages.find(({ text: pageText }) =>
			pageText.includes("Payment timing"),
		);
		expect(timingPage?.text).toContain("Advance (33.33%)");
	});

	it("repeats a PNG logo with bounded chrome on every explicit page", async () => {
		const logo = await readFile(
			"../../apps/web/public/images/brand/stuwiz-logo-dark.png",
		);
		const input = {
			document: {
				...documentFixture(),
				fixedTerms: Array.from({ length: 18 }, (_, index) => ({
					key: `logo-term-${index}`,
					text: `Logo fixture term ${index + 1}: approvals, access, travel, and delivery remain coordinated.`,
				})),
			},
			branding,
			quoteNumber: "QT-2026-LOGO",
			quoteVersion: 1,
			validUntil: "2026-08-17T18:29:59.999Z",
			createdAt: "2026-08-03T10:00:00.000Z",
			logoDataUri: `data:image/png;base64,${logo.toString("base64")}`,
		};
		const bytes = await renderQuotationPdf(input);
		expect(createHash("sha256").update(bytes).digest("hex")).toBe(
			"424861cee5be24b5ac7f025b95f77973471aa381c2e34bd2e72523cd85444fe8",
		);
		expect(countPdfPages(bytes)).toBe(4);
		expect(bytes.byteLength).toBe(29_657);
		const pages = await extractPdfPages(bytes);
		expect(pages).toHaveLength(countExplicitQuotationPdfPages(input));
		expectPageChrome(pages, input.quoteNumber);
		expect(bytes.toString("latin1")).toContain("/Subtype /Image");
		if (process.env.QUOTATION_PDF_ARTIFACT) {
			await mkdir("../../output/pdf", { recursive: true });
			await writeFile(
				"../../output/pdf/quotation-system-logo.pdf",
				bytes,
			);
		}
	});

	it("paginates maximum-length narrative fields", async () => {
		const document = documentFixture();
		const participant = document.participants[0];
		const event = document.events[0];
		const pkg = document.packages[0];
		const deliverable = pkg?.deliverables[0];
		const coverage = pkg?.coverage[0];
		if (!participant || !event || !pkg || !deliverable || !coverage) {
			throw new Error("Fixture is incomplete");
		}
		participant.contact.address = `ADDRESS-END ${"Long address text ".repeat(250)}`;
		event.notes = `EVENT-NOTES-END ${"Long event notes ".repeat(300)}`;
		pkg.coverage[0] = {
			...coverage,
			roles: `COVERAGE-END ${"Coverage details ".repeat(300)}`,
		};
		deliverable.details = `DELIVERABLE-END ${"Deliverable details ".repeat(300)}`;
		document.fixedTerms = Array.from({ length: 8 }, (_, index) => ({
			key: `long-term-${index}`,
			text: `TERM-${index}-END ${"Long contractual clause ".repeat(180)}`,
		}));
		const input = {
			document,
			branding,
			quoteNumber: "QT-2026-LONG",
			quoteVersion: 1,
			validUntil: "2026-08-17T18:29:59.999Z",
			createdAt: "2026-08-03T10:00:00.000Z",
		};
		const bytes = await renderQuotationPdf(input);
		expect(createHash("sha256").update(bytes).digest("hex")).toBe(
			"b383abd8081a867a010d71c63927b4fb8a5c786026e8300baad137318b0c2b17",
		);
		expect(countPdfPages(bytes)).toBe(36);
		expect(bytes.byteLength).toBe(163_583);
		expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
		expect(countPdfPages(bytes)).toBeGreaterThan(8);
		const pages = await extractPdfPages(bytes);
		expect(pages).toHaveLength(countExplicitQuotationPdfPages(input));
		expectPageChrome(pages, input.quoteNumber);
		const text = pages.map((page) => page.text).join(" ");
		expect(text).toContain("INR 1,000.01");
		for (const marker of [
			"ADDRESS-END",
			"EVENT-NOTES-END",
			"COVERAGE-END",
			"DELIVERABLE-END",
			"TERM-7-END",
		]) {
			expect(text).toContain(marker);
		}
		if (process.env.QUOTATION_PDF_ARTIFACT) {
			await mkdir("../../output/pdf", { recursive: true });
			await writeFile(
				"../../output/pdf/quotation-system-max-length.pdf",
				bytes,
			);
		}
	});
});
