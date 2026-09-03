import { createHash } from "node:crypto";
import { getUploadsBucketName } from "@repo/env";
import { putObject } from "@repo/storage";
import { quotationBrandingSnapshotV1Schema } from "../../studio/schemas/quotation-document";
import {
	assertQuotationPdfOutputEnvelope,
	assertQuotationPdfPagePlan,
	assertQuotationPdfRenderingEnvelope,
} from "../pdf/preflight";
import { countPdfPages } from "../pdf/quotation-pdf";
import {
	assertQuotationPdfTemplateCompatibility,
	quotationPdfTemplateRegistry,
} from "../pdf/registry";
import type { QuotationPdfInput } from "../pdf/types";
import { canonicalQuotationJson } from "./quotation-document";
import {
	readQuotationObjectBytes,
	verifyStoredQuotationPdfBytes,
} from "./quotation-pdf-service";
import { frozenQuotationPdfSourceSchema } from "./quotation-render-contract";

const RENDER_TIMEOUT_MS = 15_000;

export interface FrozenQuotationPdfArtifactIntent {
	organizationId: string;
	quoteId: string;
	quoteVersion: number;
	sourceDocument: unknown;
	sourceFingerprint: string;
	brandingSnapshot: unknown;
	brandingFingerprint: string;
	templateId: string;
	templateVersion: number;
	copyProfileVersion: number;
	composerVersion: number;
	rendererVersion: string;
}

export interface QuotationPdfArtifact {
	storageKey: string;
	sha256: string;
	pageCount: number;
	byteSize: number;
	renderedAt: Date;
}

export interface QuotationPdfArtifactDependencies {
	readObjectBytes: (key: string) => Promise<Buffer | null>;
	putObjectBytes: (key: string, bytes: Buffer) => Promise<void>;
	now: () => Date;
}

const defaultDependencies: QuotationPdfArtifactDependencies = {
	readObjectBytes: readQuotationObjectBytes,
	putObjectBytes: async (key, bytes) => {
		await putObject(key, {
			bucket: getUploadsBucketName(),
			body: bytes,
			contentType: "application/pdf",
			contentLength: bytes.byteLength,
		});
	},
	now: () => new Date(),
};

function fingerprint(value: unknown): string {
	return createHash("sha256")
		.update(canonicalQuotationJson(value))
		.digest("hex");
}

async function renderWithTimeout(
	render: () => Promise<Buffer>,
): Promise<{ bytes: Buffer; durationMs: number }> {
	const startedAt = Date.now();
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	try {
		const bytes = await Promise.race([
			render(),
			new Promise<never>((_, reject) => {
				timeoutId = setTimeout(
					() => reject(new Error("Quotation PDF render timed out")),
					RENDER_TIMEOUT_MS,
				);
			}),
		]);
		return { bytes, durationMs: Date.now() - startedAt };
	} finally {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	}
}

export async function renderAndStoreFrozenQuotationPdf(
	intent: FrozenQuotationPdfArtifactIntent,
	dependencies: QuotationPdfArtifactDependencies = defaultDependencies,
): Promise<QuotationPdfArtifact> {
	const source = frozenQuotationPdfSourceSchema.parse(intent.sourceDocument);
	const branding = quotationBrandingSnapshotV1Schema.parse(
		intent.brandingSnapshot,
	);
	if (
		source.quoteVersion !== intent.quoteVersion ||
		fingerprint(source.document) !== intent.sourceFingerprint ||
		fingerprint(branding) !== intent.brandingFingerprint
	) {
		throw new Error("Frozen quotation PDF input fingerprint mismatch");
	}
	const template = quotationPdfTemplateRegistry.getExact(
		intent.templateId,
		intent.templateVersion,
	);
	if (
		template.copyProfile.version !== intent.copyProfileVersion ||
		template.manifest.composerVersion !== intent.composerVersion ||
		template.manifest.rendererVersion !== intent.rendererVersion
	) {
		throw new Error(
			"Frozen quotation PDF renderer identity is unavailable",
		);
	}
	const input: QuotationPdfInput = {
		document: source.document,
		branding,
		quoteNumber: source.quoteNumber,
		quoteVersion: source.quoteVersion,
		validUntil: source.validUntil,
		createdAt: source.createdAt,
		logoDataUri: source.logoDataUri,
	};
	assertQuotationPdfTemplateCompatibility(template, input);
	await assertQuotationPdfRenderingEnvelope(input);
	assertQuotationPdfPagePlan(template.countExplicitPages(input));
	const rendered = await renderWithTimeout(() => template.render(input));
	const pageCount = countPdfPages(rendered.bytes);
	assertQuotationPdfOutputEnvelope({
		pageCount,
		durationMs: rendered.durationMs,
		byteSize: rendered.bytes.byteLength,
	});
	const sha256 = createHash("sha256").update(rendered.bytes).digest("hex");
	const storageKey = `quotations/${intent.organizationId}/${intent.quoteId}/v${intent.quoteVersion}/${sha256}.pdf`;
	await dependencies.putObjectBytes(storageKey, rendered.bytes);
	const stored = await dependencies.readObjectBytes(storageKey);
	if (!stored) {
		throw new Error("Stored quotation PDF bytes are missing");
	}
	verifyStoredQuotationPdfBytes(stored, {
		sha256,
		byteSize: rendered.bytes.byteLength,
	});
	return {
		storageKey,
		sha256,
		pageCount,
		byteSize: rendered.bytes.byteLength,
		renderedAt: dependencies.now(),
	};
}
