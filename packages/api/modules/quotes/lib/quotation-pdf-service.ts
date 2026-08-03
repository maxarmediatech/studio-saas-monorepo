import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { and, db, eq, isNull, organizations, quotes } from "@repo/database";
import { getUploadsBucketName } from "@repo/env";
import { getObject, putObject } from "@repo/storage";
import sharp from "sharp";
import {
	safeTrackActivity,
	trackActivityWithExecutor,
} from "../../activities/lib";
import type { StudioContext } from "../../studio/lib/permissions";
import {
	QUOTATION_PDF_RENDERER_VERSION,
	type QuotationBrandingSnapshotV1,
	quotationBrandingSnapshotV1Schema,
	strictQuotationDocumentV1Schema,
} from "../../studio/schemas/quotation-document";
import { countPdfPages, renderQuotationPdf } from "../pdf/quotation-pdf";
import { replaceNormalizedDocumentChildren } from "./quotation-document-service";

type Context = Pick<StudioContext, "organizationId" | "membership" | "user">;

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

async function readObjectBytes(key: string): Promise<Buffer | null> {
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

async function resolveBranding(organizationId: string): Promise<{
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
		const source = await readObjectBytes(logoKey);
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
		bytes = await Promise.race([renderQuotationPdf(input), timeout]);
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
	const document = strictQuotationDocumentV1Schema.parse(quote.document);
	const { branding, logoDataUri } = await resolveBranding(organizationId);
	const rendered = await renderWithLimits({
		document,
		branding,
		quoteNumber: quote.quoteNumber,
		quoteVersion: quote.version,
		validUntil: quote.expiresAt?.toISOString() ?? null,
		createdAt: quote.createdAt.toISOString(),
		logoDataUri,
	});
	return {
		...rendered,
		sha256: createHash("sha256").update(rendered.bytes).digest("hex"),
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
	const bytes = await readObjectBytes(quote.pdfStorageKey);
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

export async function sendDocumentQuotation(
	context: Context,
	quoteId: string,
	expectedRevision: number,
): Promise<{ id: string }> {
	const quote = await db.query.quotes.findFirst({
		where: and(
			eq(quotes.id, quoteId),
			eq(quotes.organizationId, context.organizationId),
			eq(quotes.status, "draft"),
			isNull(quotes.deletedAt),
		),
	});
	if (!quote) {
		throw new ORPCError("NOT_FOUND", {
			message: "Quotation draft not found",
		});
	}
	if (
		quote.documentVersion !== 1 ||
		quote.documentRevision !== expectedRevision
	) {
		throw new ORPCError("CONFLICT", {
			message: "Quotation revision changed before send",
		});
	}
	const document = strictQuotationDocumentV1Schema.parse(quote.document);
	const { branding, logoDataUri } = await resolveBranding(
		context.organizationId,
	);
	let uploadedKey: string | null = null;
	try {
		const rendered = await renderWithLimits({
			document,
			branding,
			quoteNumber: quote.quoteNumber,
			quoteVersion: quote.version,
			validUntil: quote.expiresAt?.toISOString() ?? null,
			createdAt: quote.createdAt.toISOString(),
			logoDataUri,
		});
		const pdfSha256 = createHash("sha256")
			.update(rendered.bytes)
			.digest("hex");
		uploadedKey = `quotations/${context.organizationId}/${quote.id}/v${quote.version}/${pdfSha256}.pdf`;
		await putObject(uploadedKey, {
			bucket: getUploadsBucketName(),
			body: rendered.bytes,
			contentType: "application/pdf",
			contentLength: rendered.bytes.byteLength,
		});
		return await db.transaction(async (tx) => {
			const [locked] = await tx
				.select()
				.from(quotes)
				.where(
					and(
						eq(quotes.id, quoteId),
						eq(quotes.organizationId, context.organizationId),
					),
				)
				.for("update");
			if (
				!locked ||
				locked.status !== "draft" ||
				locked.documentRevision !== expectedRevision ||
				locked.documentSha256 !== quote.documentSha256
			) {
				throw new ORPCError("CONFLICT", {
					message: "Quotation changed while PDF was rendering",
				});
			}
			const now = new Date();
			await replaceNormalizedDocumentChildren(
				tx,
				context.organizationId,
				quoteId,
				document,
			);
			await tx
				.update(quotes)
				.set({
					status: "sent",
					sentAt: now,
					brandingSnapshot: branding,
					pdfStorageKey: uploadedKey,
					pdfSha256,
					pdfRenderedAt: now,
					pdfRendererVersion: QUOTATION_PDF_RENDERER_VERSION,
					pdfPageCount: rendered.pageCount,
					pdfByteSize: rendered.bytes.byteLength,
					updatedAt: now,
					updatedBy: context.user.id,
				})
				.where(eq(quotes.id, quoteId));
			await trackActivityWithExecutor(
				tx,
				{ organizationId: context.organizationId, user: context.user },
				{
					entityType: "quote",
					entityId: quoteId,
					entityName: quote.title,
					action: "status_changed",
					field: "status",
					oldValue: "draft",
					newValue: "sent",
					metadata: {
						pdfSha256,
						pageCount: rendered.pageCount,
						byteSize: rendered.bytes.byteLength,
						rendererVersion: QUOTATION_PDF_RENDERER_VERSION,
						renderDurationMs: rendered.durationMs,
					},
				},
			);
			return { id: quoteId };
		});
	} catch (error) {
		// A concurrent send can share this content-addressed key. Immediate
		// deletion could remove the winner's evidence; age-gated cleanup owns it.
		await safeTrackActivity(context, {
			entityType: "quote",
			entityId: quoteId,
			entityName: quote.title,
			action: "updated",
			metadata: {
				event: "pdf_generation_failed",
				documentRevision: expectedRevision,
				rendererVersion: QUOTATION_PDF_RENDERER_VERSION,
			},
		});
		throw error;
	}
}
