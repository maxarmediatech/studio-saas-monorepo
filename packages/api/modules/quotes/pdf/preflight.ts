import { createHash } from "node:crypto";
import sharp from "sharp";
import {
	buildQuotationSemanticModel,
	quotationSemanticText,
} from "./semantic-model";
import type { QuotationPdfInput } from "./types";

export const QUOTATION_PDF_RENDERING_LIMITS = {
	participants: 10,
	events: 20,
	packages: 10,
	coverageRows: 100,
	deliverables: 200,
	paymentMilestones: 3,
	deliveryTimelineClauses: 20,
	fixedTerms: 30,
	proseFieldCodePoints: 5_000,
	aggregateTextCodePoints: 100_000,
	serializedInputBytes: 1024 * 1024,
	logoBytes: 2 * 1024 * 1024,
	logoWidth: 4_096,
	logoHeight: 4_096,
	logoPixels: 16_000_000,
	pages: 50,
	renderDurationMs: 15_000,
	pdfBytes: 20 * 1024 * 1024,
} as const;

export type QuotationPdfPreflightErrorCode =
	| "PARTICIPANTS_LIMIT"
	| "EVENTS_LIMIT"
	| "PACKAGES_LIMIT"
	| "COVERAGE_LIMIT"
	| "DELIVERABLES_LIMIT"
	| "PAYMENT_MILESTONES_LIMIT"
	| "DELIVERY_TIMELINES_LIMIT"
	| "FIXED_TERMS_LIMIT"
	| "PROSE_FIELD_LIMIT"
	| "AGGREGATE_TEXT_LIMIT"
	| "SERIALIZED_INPUT_LIMIT"
	| "INVALID_LOGO"
	| "LOGO_IDENTITY_MISMATCH"
	| "LOGO_BYTES_LIMIT"
	| "LOGO_DIMENSIONS_LIMIT"
	| "PAGE_LIMIT"
	| "RENDER_DURATION_LIMIT"
	| "PDF_BYTES_LIMIT";

export class QuotationPdfPreflightError extends Error {
	constructor(
		readonly code: QuotationPdfPreflightErrorCode,
		message: string,
	) {
		super(message);
		this.name = "QuotationPdfPreflightError";
	}
}

export interface QuotationPdfPreflightMetrics {
	coverageRows: number;
	deliverables: number;
	aggregateTextCodePoints: number;
	serializedInputBytes: number;
	logoBytes: number;
}

function codePoints(value: string): number {
	return Array.from(value).length;
}

function assertMaximum(
	actual: number,
	maximum: number,
	code: QuotationPdfPreflightErrorCode,
	label: string,
): void {
	if (actual > maximum) {
		throw new QuotationPdfPreflightError(
			code,
			`${label} exceeds the quotation PDF limit of ${maximum}`,
		);
	}
}

function renderedProseFields(input: QuotationPdfInput): string[] {
	return [
		...input.document.participants.flatMap(({ contact }) =>
			contact.address ? [contact.address] : [],
		),
		...input.document.events.flatMap((event) =>
			[event.dateWindow, event.location, event.notes].filter(
				(value): value is string => value !== null,
			),
		),
		...input.document.packages.flatMap((item) => [
			...(item.summary ? [item.summary] : []),
			...item.coverage.flatMap(({ roles }) => (roles ? [roles] : [])),
			...item.deliverables.flatMap(({ details }) =>
				details ? [details] : [],
			),
		]),
		...input.document.deliveryTimelines.map(({ text }) => text),
		...input.document.paymentMilestones.map(({ timing }) => timing),
		...input.document.fixedTerms.map(({ text }) => text),
	];
}

function serializedInputBytes(input: QuotationPdfInput): number {
	const { logoDataUri: _logoDataUri, ...sourceInput } = input;
	return Buffer.byteLength(JSON.stringify(sourceInput), "utf8");
}

async function inspectLogo(input: QuotationPdfInput): Promise<number> {
	if (!input.logoDataUri) {
		if (input.branding.logoMimeType || input.branding.logoSha256) {
			throw new QuotationPdfPreflightError(
				"LOGO_IDENTITY_MISMATCH",
				"Quotation PDF branding references a missing logo",
			);
		}
		return 0;
	}
	const match = input.logoDataUri.match(
		/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]*={0,2})$/,
	);
	if (!match?.[1] || match[2] === undefined || match[2].length % 4 !== 0) {
		throw new QuotationPdfPreflightError(
			"INVALID_LOGO",
			"Quotation PDF logo must be a valid PNG or JPEG data URI",
		);
	}
	const bytes = Buffer.from(match[2], "base64");
	assertMaximum(
		bytes.byteLength,
		QUOTATION_PDF_RENDERING_LIMITS.logoBytes,
		"LOGO_BYTES_LIMIT",
		"Decoded logo bytes",
	);
	let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
	try {
		metadata = await sharp(bytes).metadata();
	} catch {
		throw new QuotationPdfPreflightError(
			"INVALID_LOGO",
			"Quotation PDF logo could not be decoded",
		);
	}
	const declaredMime = match[1];
	const detectedMime =
		metadata.format === "png"
			? "image/png"
			: metadata.format === "jpeg"
				? "image/jpeg"
				: null;
	if (
		!detectedMime ||
		detectedMime !== declaredMime ||
		(input.branding.logoMimeType !== null &&
			input.branding.logoMimeType !== detectedMime) ||
		(input.branding.logoSha256 !== null &&
			input.branding.logoSha256 !==
				createHash("sha256").update(bytes).digest("hex"))
	) {
		throw new QuotationPdfPreflightError(
			"LOGO_IDENTITY_MISMATCH",
			"Quotation PDF logo does not match its branding identity",
		);
	}
	const width = metadata.width ?? 0;
	const height = metadata.height ?? 0;
	if (
		!width ||
		!height ||
		width > QUOTATION_PDF_RENDERING_LIMITS.logoWidth ||
		height > QUOTATION_PDF_RENDERING_LIMITS.logoHeight ||
		width * height > QUOTATION_PDF_RENDERING_LIMITS.logoPixels
	) {
		throw new QuotationPdfPreflightError(
			"LOGO_DIMENSIONS_LIMIT",
			"Quotation PDF logo exceeds supported dimensions",
		);
	}
	return bytes.byteLength;
}

export function assertQuotationPdfPagePlan(pageCount: number): void {
	assertMaximum(
		pageCount,
		QUOTATION_PDF_RENDERING_LIMITS.pages,
		"PAGE_LIMIT",
		"Generated PDF pages",
	);
}

export function assertQuotationPdfOutputEnvelope(output: {
	pageCount: number;
	durationMs: number;
	byteSize: number;
}): void {
	assertQuotationPdfPagePlan(output.pageCount);
	assertMaximum(
		output.durationMs,
		QUOTATION_PDF_RENDERING_LIMITS.renderDurationMs,
		"RENDER_DURATION_LIMIT",
		"PDF render duration",
	);
	assertMaximum(
		output.byteSize,
		QUOTATION_PDF_RENDERING_LIMITS.pdfBytes,
		"PDF_BYTES_LIMIT",
		"Generated PDF bytes",
	);
}

export async function assertQuotationPdfRenderingEnvelope(
	input: QuotationPdfInput,
): Promise<QuotationPdfPreflightMetrics> {
	const { document } = input;
	const coverageRows = document.packages.reduce(
		(total, item) => total + item.coverage.length,
		0,
	);
	const deliverables = document.packages.reduce(
		(total, item) => total + item.deliverables.length,
		0,
	);
	assertMaximum(
		document.participants.length,
		QUOTATION_PDF_RENDERING_LIMITS.participants,
		"PARTICIPANTS_LIMIT",
		"Participants",
	);
	assertMaximum(
		document.events.length,
		QUOTATION_PDF_RENDERING_LIMITS.events,
		"EVENTS_LIMIT",
		"Events",
	);
	assertMaximum(
		document.packages.length,
		QUOTATION_PDF_RENDERING_LIMITS.packages,
		"PACKAGES_LIMIT",
		"Packages",
	);
	assertMaximum(
		coverageRows,
		QUOTATION_PDF_RENDERING_LIMITS.coverageRows,
		"COVERAGE_LIMIT",
		"Coverage rows",
	);
	assertMaximum(
		deliverables,
		QUOTATION_PDF_RENDERING_LIMITS.deliverables,
		"DELIVERABLES_LIMIT",
		"Deliverables",
	);
	assertMaximum(
		document.paymentMilestones.length,
		QUOTATION_PDF_RENDERING_LIMITS.paymentMilestones,
		"PAYMENT_MILESTONES_LIMIT",
		"Payment milestones",
	);
	assertMaximum(
		document.deliveryTimelines.length,
		QUOTATION_PDF_RENDERING_LIMITS.deliveryTimelineClauses,
		"DELIVERY_TIMELINES_LIMIT",
		"Delivery timeline clauses",
	);
	assertMaximum(
		document.fixedTerms.length,
		QUOTATION_PDF_RENDERING_LIMITS.fixedTerms,
		"FIXED_TERMS_LIMIT",
		"Fixed terms",
	);
	for (const value of renderedProseFields(input)) {
		assertMaximum(
			codePoints(value),
			QUOTATION_PDF_RENDERING_LIMITS.proseFieldCodePoints,
			"PROSE_FIELD_LIMIT",
			"Rendered prose field",
		);
	}
	const aggregateTextCodePoints = quotationSemanticText(
		buildQuotationSemanticModel(input),
	).reduce((total, value) => total + codePoints(value), 0);
	assertMaximum(
		aggregateTextCodePoints,
		QUOTATION_PDF_RENDERING_LIMITS.aggregateTextCodePoints,
		"AGGREGATE_TEXT_LIMIT",
		"Rendered text",
	);
	const inputBytes = serializedInputBytes(input);
	assertMaximum(
		inputBytes,
		QUOTATION_PDF_RENDERING_LIMITS.serializedInputBytes,
		"SERIALIZED_INPUT_LIMIT",
		"Serialized render input",
	);
	return {
		coverageRows,
		deliverables,
		aggregateTextCodePoints,
		serializedInputBytes: inputBytes,
		logoBytes: await inspectLogo(input),
	};
}
