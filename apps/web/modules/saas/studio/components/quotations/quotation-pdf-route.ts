export function requestedQuotationRevision(
	searchParams: URLSearchParams,
	currentRevision: number,
): number {
	const requested = Number(searchParams.get("revision"));
	return Number.isInteger(requested) && requested > 0
		? requested
		: currentRevision;
}
