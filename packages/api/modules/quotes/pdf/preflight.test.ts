import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
	assertQuotationPdfOutputEnvelope,
	assertQuotationPdfPagePlan,
	assertQuotationPdfRenderingEnvelope,
	QUOTATION_PDF_RENDERING_LIMITS,
	QuotationPdfPreflightError,
	type QuotationPdfPreflightErrorCode,
} from "./preflight";
import { quotationPdfInputFixture } from "./quotation-pdf.fixture";
import type { QuotationPdfInput } from "./types";

async function expectPreflightCode(
	input: QuotationPdfInput,
	code: QuotationPdfPreflightErrorCode,
): Promise<void> {
	try {
		await assertQuotationPdfRenderingEnvelope(input);
	} catch (error) {
		expect(error).toBeInstanceOf(QuotationPdfPreflightError);
		expect((error as QuotationPdfPreflightError).code).toBe(code);
		return;
	}
	throw new Error(`Expected preflight error ${code}`);
}

function dataUri(mime: "image/png" | "image/jpeg", bytes: Buffer): string {
	return `data:${mime};base64,${bytes.toString("base64")}`;
}

function boundaryInput(): QuotationPdfInput {
	const input = quotationPdfInputFixture();
	const participant = input.document.participants[0];
	const event = input.document.events[0];
	const pkg = input.document.packages[0];
	const coverage = pkg?.coverage[0];
	const deliverable = pkg?.deliverables[0];
	if (!participant || !event || !pkg || !coverage || !deliverable) {
		throw new Error("Fixture is incomplete");
	}
	input.document.participants = Array.from({ length: 10 }, (_, index) => ({
		...participant,
		key: `participant-${index}`,
		contact: { ...participant.contact, name: `Participant ${index}` },
	}));
	input.document.events = Array.from({ length: 20 }, (_, index) => ({
		...event,
		key: `event-${index}`,
		eventType: { ...event.eventType, label: `Event ${index}` },
	}));
	input.document.packages = Array.from({ length: 10 }, (_, packageIndex) => ({
		...pkg,
		key: `package-${packageIndex}`,
		coverage: Array.from({ length: 10 }, (_, index) => ({
			...coverage,
			key: `coverage-${packageIndex}-${index}`,
			eventKey: `event-${index}`,
		})),
		deliverables: Array.from({ length: 20 }, (_, index) => ({
			...deliverable,
			key: `deliverable-${packageIndex}-${index}`,
			name: `Deliverable ${packageIndex}-${index}`,
		})),
	}));
	input.document.deliveryTimelines = Array.from(
		{ length: 20 },
		(_, index) => ({ key: `timeline-${index}`, text: `Timeline ${index}` }),
	);
	input.document.fixedTerms = Array.from({ length: 30 }, (_, index) => ({
		key: `term-${index}`,
		text: `Term ${index}`,
	}));
	return input;
}

describe("quotation PDF rendering-envelope preflight", () => {
	it("accepts the documented aggregate count boundaries", async () => {
		const metrics = await assertQuotationPdfRenderingEnvelope(
			boundaryInput(),
		);
		expect(metrics).toMatchObject({
			coverageRows: 100,
			deliverables: 200,
			logoBytes: 0,
		});
		expect(metrics.aggregateTextCodePoints).toBeLessThanOrEqual(100_000);
		expect(metrics.serializedInputBytes).toBeLessThanOrEqual(1024 * 1024);
	});

	it.each([
		{
			name: "participants",
			code: "PARTICIPANTS_LIMIT" as const,
			mutate(input: QuotationPdfInput) {
				const item = input.document.participants[0];
				if (item) {
					input.document.participants = Array.from(
						{ length: 11 },
						(_, index) => ({
							...item,
							key: `participant-${index}`,
						}),
					);
				}
			},
		},
		{
			name: "events",
			code: "EVENTS_LIMIT" as const,
			mutate(input: QuotationPdfInput) {
				const item = input.document.events[0];
				if (item) {
					input.document.events = Array.from(
						{ length: 21 },
						(_, index) => ({ ...item, key: `event-${index}` }),
					);
				}
			},
		},
		{
			name: "packages",
			code: "PACKAGES_LIMIT" as const,
			mutate(input: QuotationPdfInput) {
				const item = input.document.packages[0];
				if (item) {
					input.document.packages = Array.from(
						{ length: 11 },
						(_, index) => ({ ...item, key: `package-${index}` }),
					);
				}
			},
		},
		{
			name: "coverage rows",
			code: "COVERAGE_LIMIT" as const,
			mutate(input: QuotationPdfInput) {
				const item = input.document.packages[0];
				const row = item?.coverage[0];
				if (item && row) {
					item.coverage = Array.from({ length: 101 }, (_, index) => ({
						...row,
						key: `coverage-${index}`,
					}));
				}
			},
		},
		{
			name: "deliverables",
			code: "DELIVERABLES_LIMIT" as const,
			mutate(input: QuotationPdfInput) {
				const item = input.document.packages[0];
				const row = item?.deliverables[0];
				if (item && row) {
					item.deliverables = Array.from(
						{ length: 201 },
						(_, index) => ({ ...row, key: `deliverable-${index}` }),
					);
				}
			},
		},
		{
			name: "payment milestones",
			code: "PAYMENT_MILESTONES_LIMIT" as const,
			mutate(input: QuotationPdfInput) {
				const item = input.document.paymentMilestones[0];
				if (item) {
					input.document.paymentMilestones = Array.from(
						{ length: 4 },
						(_, index) => ({ ...item, key: `payment-${index}` }),
					);
				}
			},
		},
		{
			name: "delivery timelines",
			code: "DELIVERY_TIMELINES_LIMIT" as const,
			mutate(input: QuotationPdfInput) {
				input.document.deliveryTimelines = Array.from(
					{ length: 21 },
					(_, index) => ({
						key: `timeline-${index}`,
						text: "Timeline",
					}),
				);
			},
		},
		{
			name: "fixed terms",
			code: "FIXED_TERMS_LIMIT" as const,
			mutate(input: QuotationPdfInput) {
				input.document.fixedTerms = Array.from(
					{ length: 31 },
					(_, index) => ({ key: `term-${index}`, text: "Term" }),
				);
			},
		},
	])("rejects $name above its limit", async ({ code, mutate }) => {
		const input = quotationPdfInputFixture();
		mutate(input);
		await expectPreflightCode(input, code);
	});

	it("rejects per-field and aggregate rendered text limits", async () => {
		const field = quotationPdfInputFixture();
		const participant = field.document.participants[0];
		if (!participant) {
			throw new Error("Fixture is incomplete");
		}
		participant.contact.address = "x".repeat(5_001);
		await expectPreflightCode(field, "PROSE_FIELD_LIMIT");

		const aggregate = quotationPdfInputFixture();
		aggregate.document.fixedTerms = Array.from(
			{ length: 30 },
			(_, index) => ({ key: `term-${index}`, text: "x".repeat(3_500) }),
		);
		await expectPreflightCode(aggregate, "AGGREGATE_TEXT_LIMIT");
	});

	it("rejects oversized serialized source input", async () => {
		const input = quotationPdfInputFixture();
		input.branding = {
			...input.branding,
			address: "x".repeat(1024 * 1024),
		};
		await expectPreflightCode(input, "SERIALIZED_INPUT_LIMIT");
	});

	it("validates logo bytes, encoding, and dimensions", async () => {
		const invalid = quotationPdfInputFixture();
		invalid.logoDataUri = "data:image/png;base64,%%%";
		await expectPreflightCode(invalid, "INVALID_LOGO");

		const oversized = quotationPdfInputFixture();
		oversized.logoDataUri = dataUri(
			"image/png",
			Buffer.alloc(2 * 1024 * 1024 + 1),
		);
		await expectPreflightCode(oversized, "LOGO_BYTES_LIMIT");

		const widePng = await sharp({
			create: {
				width: 4_097,
				height: 1,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 1 },
			},
		})
			.png()
			.toBuffer();
		const wide = quotationPdfInputFixture();
		wide.logoDataUri = dataUri("image/png", widePng);
		await expectPreflightCode(wide, "LOGO_DIMENSIONS_LIMIT");

		const validPng = await sharp({
			create: {
				width: 32,
				height: 16,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 1 },
			},
		})
			.png()
			.toBuffer();
		const mismatched = quotationPdfInputFixture();
		mismatched.logoDataUri = dataUri("image/png", validPng);
		mismatched.branding = {
			...mismatched.branding,
			logoMimeType: "image/png",
			logoSha256: "0".repeat(64),
		};
		await expectPreflightCode(mismatched, "LOGO_IDENTITY_MISMATCH");

		const valid = quotationPdfInputFixture();
		valid.logoDataUri = dataUri("image/png", validPng);
		await expect(
			assertQuotationPdfRenderingEnvelope(valid),
		).resolves.toMatchObject({ logoBytes: validPng.byteLength });
	});

	it("enforces page-plan and post-render boundaries for later wiring", () => {
		expect(() => assertQuotationPdfPagePlan(50)).not.toThrow();
		expect(() => assertQuotationPdfPagePlan(51)).toThrowError(
			expect.objectContaining({ code: "PAGE_LIMIT" }),
		);
		expect(() =>
			assertQuotationPdfOutputEnvelope({
				pageCount: 50,
				durationMs: 15_000,
				byteSize: 20 * 1024 * 1024,
			}),
		).not.toThrow();
		expect(() =>
			assertQuotationPdfOutputEnvelope({
				pageCount: 1,
				durationMs: 15_001,
				byteSize: 1,
			}),
		).toThrowError(
			expect.objectContaining({ code: "RENDER_DURATION_LIMIT" }),
		);
		expect(() =>
			assertQuotationPdfOutputEnvelope({
				pageCount: 1,
				durationMs: 1,
				byteSize: 20 * 1024 * 1024 + 1,
			}),
		).toThrowError(expect.objectContaining({ code: "PDF_BYTES_LIMIT" }));
		expect(QUOTATION_PDF_RENDERING_LIMITS.pages).toBe(50);
	});
});
