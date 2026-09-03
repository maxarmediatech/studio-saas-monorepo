export function authoritativeQuotationQuery<Options extends object>(
	options: Options,
): Options & { staleTime: 0 } {
	return { ...options, staleTime: 0 };
}

export function isQuotationPresentationRevisionCurrent(
	currentRevision: number | null,
	expectedRevision: number | undefined,
): boolean {
	return (
		expectedRevision === undefined || currentRevision === expectedRevision
	);
}

export function quotationPresentationRevisionToRefetch(
	currentRevision: number | null,
	expectedRevision: number | undefined,
	lastRequestedRevision: number | null,
): number | null {
	if (
		currentRevision === null ||
		isQuotationPresentationRevisionCurrent(
			currentRevision,
			expectedRevision,
		) ||
		expectedRevision === lastRequestedRevision
	) {
		return null;
	}
	return expectedRevision ?? null;
}
