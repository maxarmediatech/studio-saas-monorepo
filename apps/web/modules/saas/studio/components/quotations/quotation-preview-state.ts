export interface QuotationPreviewResource {
	canonicalUrl: string;
	objectUrl: string;
}

export interface QuotationPreviewResourceState {
	displayed: QuotationPreviewResource | null;
	prepared: QuotationPreviewResource | null;
}

export function promoteQuotationPreviewResource(
	state: QuotationPreviewResourceState,
	objectUrl: string,
	currentCanonicalUrl: string,
): QuotationPreviewResourceState {
	if (
		!state.prepared ||
		state.prepared.objectUrl !== objectUrl ||
		state.prepared.canonicalUrl !== currentCanonicalUrl
	) {
		return state;
	}
	return { displayed: state.prepared, prepared: null };
}

export function listQuotationPreviewResources(
	state: QuotationPreviewResourceState,
): QuotationPreviewResource[] {
	if (!state.displayed) {
		return state.prepared ? [state.prepared] : [];
	}
	if (
		!state.prepared ||
		state.prepared.objectUrl === state.displayed.objectUrl
	) {
		return [state.displayed];
	}
	return [state.displayed, state.prepared];
}

export interface QuotationPreviewFrameState {
	displayedUrl: string | null;
	loadingUrl: string | null;
}

export function syncQuotationPreviewTarget(
	state: QuotationPreviewFrameState,
	targetUrl: string,
): QuotationPreviewFrameState {
	if (state.displayedUrl === targetUrl) {
		return state.loadingUrl === null
			? state
			: { ...state, loadingUrl: null };
	}
	if (state.loadingUrl === targetUrl) {
		return state;
	}
	return { ...state, loadingUrl: targetUrl };
}

export function completeQuotationPreviewLoad(
	state: QuotationPreviewFrameState,
	loadedUrl: string,
	targetUrl: string,
): QuotationPreviewFrameState {
	if (loadedUrl !== targetUrl || state.loadingUrl !== loadedUrl) {
		return state;
	}
	return { displayedUrl: loadedUrl, loadingUrl: null };
}
