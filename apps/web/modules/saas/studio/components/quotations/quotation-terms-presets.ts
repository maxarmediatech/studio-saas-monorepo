import type { Configuration } from "@repo/api/modules/studio/schemas/configuration";
import { quotationTermsMetadataV1Schema } from "@repo/api/modules/studio/schemas/quotation-document";
import {
	createNeutralPaymentMilestones,
	type QuotationDraft,
} from "./quotation-wizard-data";

export function eligibleQuotationTermsPresets(
	configurations: Configuration[],
	bookingTypeKey: string | null,
): Configuration[] {
	return configurations.filter(
		(item) =>
			item.type === "quotation_terms" &&
			item.isActive &&
			(!item.bookingTypeFilter ||
				item.bookingTypeFilter === bookingTypeKey),
	);
}

export function selectDefaultQuotationTermsPreset(
	configurations: Configuration[],
	bookingTypeKey: string | null,
): Configuration | null {
	return (
		eligibleQuotationTermsPresets(configurations, bookingTypeKey).find(
			(item) => item.isDefault,
		) ?? null
	);
}

export function applyQuotationTermsPreset(
	draft: QuotationDraft,
	configuration: Configuration,
): QuotationDraft | null {
	const metadata = quotationTermsMetadataV1Schema.safeParse(
		configuration.metadata,
	);
	if (!metadata.success) {
		return null;
	}

	return {
		...draft,
		termsConfiguration: {
			id: configuration.id,
			key: configuration.key,
			label: configuration.label,
			metadataVersion: metadata.data.schemaVersion,
		},
		timelines: metadata.data.deliveryTimelines.map((item) => item.text),
		timelineKeys: metadata.data.deliveryTimelines.map((item) => item.key),
		payments: metadata.data.paymentMilestones.map((item) => ({
			id: item.key,
			label: item.label,
			percent: item.percentage,
			timing: item.timing,
		})),
		terms: metadata.data.fixedTerms.map((item) => item.text),
		termKeys: metadata.data.fixedTerms.map((item) => item.key),
	};
}

export function clearQuotationTermsPreset(
	draft: QuotationDraft,
): QuotationDraft {
	return {
		...draft,
		termsConfiguration: null,
		timelines: [],
		timelineKeys: [],
		payments: createNeutralPaymentMilestones(),
		terms: [],
		termKeys: [],
	};
}

export function quotationTermsHaveContent(draft: QuotationDraft): boolean {
	return (
		draft.timelines.some((item) => item.trim()) ||
		draft.terms.some((item) => item.trim()) ||
		draft.payments.some(
			(item) =>
				item.label.trim() || item.timing.trim() || item.percent.trim(),
		)
	);
}

export function customizeQuotationTerms(
	draft: QuotationDraft,
	changes: Partial<
		Pick<
			QuotationDraft,
			"timelines" | "timelineKeys" | "payments" | "terms" | "termKeys"
		>
	>,
): QuotationDraft {
	return { ...draft, ...changes, termsConfiguration: null };
}
