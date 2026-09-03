export type QuotationPreviewFetch = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<Response>;

export async function fetchQuotationPdfBlob(
	url: string,
	signal: AbortSignal,
	request: QuotationPreviewFetch = fetch,
): Promise<Blob> {
	const response = await request(url, {
		cache: "no-store",
		credentials: "same-origin",
		signal,
	});
	if (!response.ok) {
		throw new Error(
			`Quotation preview failed with HTTP ${response.status}`,
		);
	}
	const contentType = response.headers.get("content-type")?.toLowerCase();
	if (!contentType?.includes("application/pdf")) {
		throw new Error("Quotation preview response was not a PDF");
	}
	return response.blob();
}

export function shouldAcceptQuotationPreviewResponse(
	requestedUrl: string,
	currentUrl: string,
	aborted: boolean,
): boolean {
	return !aborted && requestedUrl === currentUrl;
}
