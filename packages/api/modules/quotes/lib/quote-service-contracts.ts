import { ORPCError } from "@orpc/server";

export function assertLegacyDraftWriteBoundary(quote: {
	status: string;
	documentVersion: number | null;
}): void {
	if (quote.status !== "draft") {
		throw new ORPCError("CONFLICT", {
			message: "Only draft quotes can be edited",
		});
	}
	if (quote.documentVersion === 1) {
		throw new ORPCError("CONFLICT", {
			message:
				"Document quotations must be edited through the document API",
		});
	}
}

export function resolveQuoteSendMode(quote: {
	documentVersion: number | null;
	documentRevision: number;
}): { kind: "document"; revision: number } | { kind: "legacy" } {
	return quote.documentVersion === 1
		? { kind: "document", revision: quote.documentRevision }
		: { kind: "legacy" };
}

export function buildDocumentRevisionFields(input: {
	document: unknown;
	documentSha256: string;
}) {
	return {
		documentVersion: 1 as const,
		document: input.document,
		documentSha256: input.documentSha256,
		documentRevision: 1,
		brandingSnapshot: null,
		pdfStorageKey: null,
		pdfSha256: null,
		pdfRenderedAt: null,
		pdfRendererVersion: null,
		pdfPageCount: null,
		pdfByteSize: null,
		pdfRenderIntentId: null,
	};
}
