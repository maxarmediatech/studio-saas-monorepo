import type { QuotationDocumentV1 } from "../../studio/schemas/quotation-document";
import { strictQuotationDocumentV1Schema } from "../../studio/schemas/quotation-document";

export const DEFAULT_EDITOR_QUOTATION_THEME = "editorial-olive" as const;

export type QuotationEditorHandoffRequest = ReturnType<
	typeof buildQuotationEditorHandoffRequest
>;

export function buildQuotationEditorHandoffRequest({
	quote,
	branding,
}: {
	quote: {
		id: string;
		quoteNumber: string;
		version: number;
		documentRevision: number;
		document: unknown;
		expiresAt: Date | null;
		createdAt: Date;
	};
	branding: {
		organizationName: string;
		address: string | null;
		email: string | null;
		phone: string | null;
		taxIdentifier: string | null;
		timezone: string;
	};
}) {
	const document: QuotationDocumentV1 = strictQuotationDocumentV1Schema.parse(
		quote.document,
	);
	return {
		contractVersion: 1 as const,
		templateId: DEFAULT_EDITOR_QUOTATION_THEME,
		payload: {
			contractVersion: 1 as const,
			source: {
				type: "external.quotation" as const,
				quotationId: quote.id,
				revision: quote.documentRevision,
			},
			quote: {
				quoteNumber: quote.quoteNumber,
				quoteVersion: quote.version,
				validUntil: quote.expiresAt
					? quote.expiresAt.toISOString().slice(0, 10)
					: null,
				createdAt: quote.createdAt.toISOString(),
			},
			branding: {
				schemaVersion: 1 as const,
				organizationName: branding.organizationName,
				address: branding.address,
				email: branding.email,
				phone: branding.phone,
				taxIdentifier: branding.taxIdentifier,
				timezone: branding.timezone,
				logoUrl: null,
			},
			document,
		},
	};
}

export async function createRemoteQuotationEditorHandoff({
	editorUrl,
	secret,
	request,
	fetcher = fetch,
}: {
	editorUrl: string;
	secret: string;
	request: QuotationEditorHandoffRequest;
	fetcher?: typeof fetch;
}): Promise<string> {
	const studioOrigin = new URL(editorUrl).origin;
	const endpoint = new URL(
		"/v1/integrations/composition-handoffs",
		studioOrigin,
	);
	const body = JSON.stringify({
		version: 1,
		kind: "quotation-composition",
		payload: request,
	});
	const response = await fetcher(endpoint, {
		method: "POST",
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${secret}`,
			"Content-Type": "application/json",
			"Content-Length": String(new TextEncoder().encode(body).byteLength),
		},
		body,
		cache: "no-store",
		redirect: "error",
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok) {
		throw new Error(
			`Studio rejected the quotation handoff (${response.status})`,
		);
	}
	const result = (await response.json()) as {
		data?: { editorUrl?: unknown };
	};
	if (typeof result.data?.editorUrl !== "string") {
		throw new Error("Studio returned an invalid editor link");
	}
	const destination = new URL(result.data.editorUrl);
	if (
		destination.origin !== studioOrigin ||
		!destination.pathname.startsWith("/composition-handoffs/")
	) {
		throw new Error("Studio returned an untrusted editor link");
	}
	return destination.toString();
}
