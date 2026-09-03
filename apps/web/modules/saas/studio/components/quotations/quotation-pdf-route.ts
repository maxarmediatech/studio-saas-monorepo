export interface QuotationTemplateIdentity {
	templateId: string;
	templateVersion: number;
}

export interface QuotationPresentationIdentity
	extends QuotationTemplateIdentity {
	documentRevision: number;
	selectionVersion: number | null;
}

export function isQuotationTemplateAvailable(
	catalog: readonly QuotationTemplateIdentity[],
	selection: QuotationTemplateIdentity,
): boolean {
	return catalog.some(
		(template) =>
			template.templateId === selection.templateId &&
			template.templateVersion === selection.templateVersion,
	);
}

export const IMPLICIT_QUOTATION_SELECTION_VERSION = "implicit";

export function isQuotationPresentationConflict(error: unknown): boolean {
	if (!error || typeof error !== "object") {
		return false;
	}
	const candidate = error as {
		code?: unknown;
		status?: unknown;
		statusCode?: unknown;
	};
	return (
		candidate.code === "CONFLICT" ||
		candidate.status === 409 ||
		candidate.statusCode === 409
	);
}

export function requestedQuotationRevision(
	searchParams: URLSearchParams,
	currentRevision: number,
): number {
	const requested = Number(searchParams.get("revision"));
	return Number.isInteger(requested) && requested > 0
		? requested
		: currentRevision;
}

export function requestedQuotationPresentation(searchParams: URLSearchParams):
	| { provided: false; identity: null }
	| {
			provided: true;
			identity: Omit<
				QuotationPresentationIdentity,
				"documentRevision"
			> | null;
	  } {
	const templateId = searchParams.get("templateId");
	const templateVersionRaw = searchParams.get("templateVersion");
	const selectionVersionRaw = searchParams.get("selectionVersion");
	const provided =
		templateId !== null ||
		templateVersionRaw !== null ||
		selectionVersionRaw !== null;
	if (!provided) {
		return { provided: false, identity: null };
	}
	const templateVersion = Number(templateVersionRaw);
	const selectionVersion =
		selectionVersionRaw === IMPLICIT_QUOTATION_SELECTION_VERSION
			? null
			: Number(selectionVersionRaw);
	if (
		!templateId ||
		!Number.isSafeInteger(templateVersion) ||
		templateVersion <= 0 ||
		(selectionVersion !== null &&
			(!Number.isSafeInteger(selectionVersion) || selectionVersion <= 0))
	) {
		return { provided: true, identity: null };
	}
	return {
		provided: true,
		identity: { templateId, templateVersion, selectionVersion },
	};
}

export function buildQuotationPdfUrl(
	quoteId: string,
	identity: QuotationPresentationIdentity,
): string {
	const search = new URLSearchParams({
		revision: String(identity.documentRevision),
		templateId: identity.templateId,
		templateVersion: String(identity.templateVersion),
		selectionVersion:
			identity.selectionVersion === null
				? IMPLICIT_QUOTATION_SELECTION_VERSION
				: String(identity.selectionVersion),
	});
	return `/api/studio/quotations/${encodeURIComponent(quoteId)}/pdf?${search.toString()}`;
}
