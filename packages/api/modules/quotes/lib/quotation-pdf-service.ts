import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
import {
	and,
	db,
	eq,
	isNull,
	organizations,
	quotationPresentations,
	quotes,
} from "@repo/database";
import { getUploadsBucketName } from "@repo/env";
import { getObject } from "@repo/storage";
import sharp from "sharp";
import {
	type QuotationBrandingSnapshotV1,
	quotationBrandingSnapshotV1Schema,
	strictQuotationDocumentV1Schema,
} from "../../studio/schemas/quotation-document";
import {
	assertQuotationPdfOutputEnvelope,
	assertQuotationPdfPagePlan,
	assertQuotationPdfRenderingEnvelope,
} from "../pdf/preflight";
import { countPdfPages, renderQuotationPdf } from "../pdf/quotation-pdf";
import {
	assertQuotationPdfTemplateCompatibility,
	quotationPdfTemplateRegistry,
} from "../pdf/registry";
import {
	CLASSIC_V0_QUOTATION_TEMPLATE_ID,
	CLASSIC_V0_QUOTATION_TEMPLATE_VERSION,
} from "../pdf/templates/classic-v0";
import { canonicalQuotationJson } from "./quotation-document";

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const RENDER_TIMEOUT_MS = 15_000;

export function verifyStoredQuotationPdfBytes(
	bytes: Buffer,
	expected: { sha256: string; byteSize: number | null },
): void {
	const actualSha256 = createHash("sha256").update(bytes).digest("hex");
	if (
		actualSha256 !== expected.sha256 ||
		(expected.byteSize !== null && bytes.byteLength !== expected.byteSize)
	) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Historical quotation PDF failed integrity verification",
		});
	}
}

function organizationMetadata(value: string | null): Record<string, unknown> {
	if (!value) {
		return {};
	}
	try {
		const parsed = JSON.parse(value);
		return parsed && typeof parsed === "object"
			? (parsed as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}

function optionalMetadataText(
	metadata: Record<string, unknown>,
	key: string,
): string | null {
	const value = metadata[key];
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function readQuotationObjectBytes(
	key: string,
): Promise<Buffer | null> {
	const object = await getObject(key, { bucket: getUploadsBucketName() });
	if (!object) {
		return null;
	}
	const reader = object.body.getReader();
	const chunks: Uint8Array[] = [];
	let length = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		chunks.push(value);
		length += value.byteLength;
	}
	return Buffer.concat(
		chunks.map((chunk) => Buffer.from(chunk)),
		length,
	);
}

export async function resolveQuotationBranding(
	organizationId: string,
): Promise<{
	branding: QuotationBrandingSnapshotV1;
	logoDataUri?: string;
}> {
	const organization = await db.query.organizations.findFirst({
		where: eq(organizations.id, organizationId),
	});
	if (!organization) {
		throw new ORPCError("NOT_FOUND", { message: "Organization not found" });
	}
	const metadata = organizationMetadata(organization.metadata);
	const logoKey = organization.logo?.startsWith("org-logos/")
		? organization.logo
		: null;
	let logoMimeType: "image/png" | "image/jpeg" | null = null;
	let logoSha256: string | null = null;
	let logoDataUri: string | undefined;
	if (logoKey && !logoKey.includes("..") && !logoKey.includes("\0")) {
		const source = await readQuotationObjectBytes(logoKey);
		if (source) {
			try {
				const normalized = await sharp(source)
					.rotate()
					.resize({
						width: 480,
						height: 160,
						fit: "inside",
						withoutEnlargement: true,
					})
					.png()
					.toBuffer();
				logoMimeType = "image/png";
				logoSha256 = createHash("sha256")
					.update(normalized)
					.digest("hex");
				logoDataUri = `data:image/png;base64,${normalized.toString("base64")}`;
			} catch {
				// Unreadable logos deliberately fall back to organization name.
			}
		}
	}
	const branding = quotationBrandingSnapshotV1Schema.parse({
		schemaVersion: 1,
		organizationName: organization.name,
		address: optionalMetadataText(metadata, "address"),
		email: optionalMetadataText(metadata, "email"),
		phone: optionalMetadataText(metadata, "phone"),
		taxIdentifier:
			optionalMetadataText(metadata, "taxIdentifier") ??
			optionalMetadataText(metadata, "gstNumber"),
		timezone: organization.timezone,
		logoStorageKey: logoDataUri ? logoKey : null,
		logoMimeType,
		logoSha256,
	});
	return { branding, logoDataUri };
}

async function renderWithLimits(
	input: Parameters<typeof renderQuotationPdf>[0],
	render: (
		input: Parameters<typeof renderQuotationPdf>[0],
	) => Promise<Buffer> = renderQuotationPdf,
): Promise<{ bytes: Buffer; pageCount: number; durationMs: number }> {
	const startedAt = Date.now();
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(
			() => reject(new Error("Quotation PDF render timed out")),
			RENDER_TIMEOUT_MS,
		);
	});
	let bytes: Buffer;
	try {
		bytes = await Promise.race([render(input), timeout]);
	} finally {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	}
	if (bytes.byteLength > MAX_PDF_BYTES) {
		throw new Error("Quotation PDF exceeds 20 MiB");
	}
	return {
		bytes,
		pageCount: countPdfPages(bytes),
		durationMs: Date.now() - startedAt,
	};
}

export async function renderDraftQuotationPdf(
	organizationId: string,
	quoteId: string,
	documentRevision: number,
	requestedPresentation?: {
		templateId: string;
		templateVersion: number;
		selectionVersion: number | null;
	},
) {
	const quote = await db.query.quotes.findFirst({
		where: and(
			eq(quotes.id, quoteId),
			eq(quotes.organizationId, organizationId),
			isNull(quotes.deletedAt),
		),
	});
	if (!quote) {
		throw new ORPCError("NOT_FOUND", { message: "Quotation not found" });
	}
	if (
		quote.documentVersion !== 1 ||
		quote.documentRevision !== documentRevision
	) {
		throw new ORPCError("CONFLICT", {
			message: "Preview revision is no longer current",
		});
	}
	if (quote.status !== "draft") {
		return readStoredQuotationPdf(organizationId, quoteId);
	}
	const presentation = await db.query.quotationPresentations.findFirst({
		where: and(
			eq(quotationPresentations.quoteId, quoteId),
			eq(quotationPresentations.organizationId, organizationId),
		),
	});
	const currentPresentation = presentation
		? {
				templateId: presentation.templateId,
				templateVersion: presentation.templateVersion,
				selectionVersion: presentation.selectionVersion,
			}
		: {
				templateId: CLASSIC_V0_QUOTATION_TEMPLATE_ID,
				templateVersion: CLASSIC_V0_QUOTATION_TEMPLATE_VERSION,
				selectionVersion: null,
			};
	if (presentation && !requestedPresentation) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Preview presentation identity is required",
		});
	}
	if (
		requestedPresentation &&
		(requestedPresentation.templateId !== currentPresentation.templateId ||
			requestedPresentation.templateVersion !==
				currentPresentation.templateVersion ||
			requestedPresentation.selectionVersion !==
				currentPresentation.selectionVersion)
	) {
		throw new ORPCError("CONFLICT", {
			message: "Preview presentation is no longer current",
			data: { current: { documentRevision, ...currentPresentation } },
		});
	}
	const document = strictQuotationDocumentV1Schema.parse(quote.document);
	const { branding, logoDataUri } =
		await resolveQuotationBranding(organizationId);
	const template = quotationPdfTemplateRegistry.getActive(
		currentPresentation.templateId,
		currentPresentation.templateVersion,
	);
	const input = {
		document,
		branding,
		quoteNumber: quote.quoteNumber,
		quoteVersion: quote.version,
		validUntil: quote.expiresAt?.toISOString() ?? null,
		createdAt: quote.createdAt.toISOString(),
		logoDataUri,
	};
	assertQuotationPdfTemplateCompatibility(template, input);
	await assertQuotationPdfRenderingEnvelope(input);
	assertQuotationPdfPagePlan(template.countExplicitPages(input));
	const rendered = await renderWithLimits(input, template.render);
	assertQuotationPdfOutputEnvelope({
		pageCount: rendered.pageCount,
		durationMs: rendered.durationMs,
		byteSize: rendered.bytes.byteLength,
	});
	const sourceIdentity = {
		schemaVersion: 1,
		document,
		quoteNumber: quote.quoteNumber,
		quoteVersion: quote.version,
		validUntil: quote.expiresAt?.toISOString() ?? null,
		createdAt: quote.createdAt.toISOString(),
	};
	const identityEtag = createHash("sha256")
		.update(
			canonicalQuotationJson({
				quoteId,
				documentRevision,
				...currentPresentation,
				sourceFingerprint: createHash("sha256")
					.update(canonicalQuotationJson(sourceIdentity.document))
					.digest("hex"),
				renderMetadata: {
					quoteNumber: sourceIdentity.quoteNumber,
					quoteVersion: sourceIdentity.quoteVersion,
					validUntil: sourceIdentity.validUntil,
					createdAt: sourceIdentity.createdAt,
				},
				brandingFingerprint: createHash("sha256")
					.update(canonicalQuotationJson(branding))
					.digest("hex"),
				copyProfileVersion: template.copyProfile.version,
				composerVersion: template.manifest.composerVersion,
				rendererVersion: template.manifest.rendererVersion,
			}),
		)
		.digest("hex");
	return {
		...rendered,
		sha256: createHash("sha256").update(rendered.bytes).digest("hex"),
		identityEtag,
	};
}

export async function readStoredQuotationPdf(
	organizationId: string,
	quoteId: string,
) {
	const quote = await db.query.quotes.findFirst({
		where: and(
			eq(quotes.id, quoteId),
			eq(quotes.organizationId, organizationId),
		),
		columns: {
			pdfStorageKey: true,
			pdfSha256: true,
			pdfPageCount: true,
			pdfByteSize: true,
		},
	});
	if (!quote?.pdfStorageKey || !quote.pdfSha256) {
		throw new ORPCError("NOT_FOUND", {
			message: "Historical quotation PDF is unavailable",
		});
	}
	if (
		!quote.pdfStorageKey.startsWith(
			`quotations/${organizationId}/${quoteId}/`,
		) ||
		quote.pdfStorageKey.includes("..") ||
		quote.pdfStorageKey.includes("\0")
	) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Invalid quotation PDF identity",
		});
	}
	const bytes = await readQuotationObjectBytes(quote.pdfStorageKey);
	if (!bytes) {
		throw new ORPCError("NOT_FOUND", {
			message: "Historical quotation PDF bytes are missing",
		});
	}
	verifyStoredQuotationPdfBytes(bytes, {
		sha256: quote.pdfSha256,
		byteSize: quote.pdfByteSize,
	});
	return {
		bytes,
		sha256: quote.pdfSha256,
		pageCount: quote.pdfPageCount ?? countPdfPages(bytes),
		durationMs: 0,
	};
}
