export async function requestQuotationEditorUrl(quoteId: string) {
	const response = await fetch(
		`/api/studio/quotations/${encodeURIComponent(quoteId)}/editor`,
		{
			method: "POST",
			headers: { Accept: "application/json" },
			cache: "no-store",
		},
	);
	const body = (await response.json().catch(() => null)) as {
		data?: { editorUrl?: unknown };
		error?: unknown;
	} | null;
	if (!response.ok) {
		throw new Error(
			typeof body?.error === "string"
				? body.error
				: "Could not open quotation in the editor",
		);
	}
	if (typeof body?.data?.editorUrl !== "string") {
		throw new Error("The editor returned an invalid link");
	}
	return body.data.editorUrl;
}

export async function openQuotationInEditor(quoteId: string) {
	const editorUrl = await requestQuotationEditorUrl(quoteId);
	window.location.assign(editorUrl);
}
