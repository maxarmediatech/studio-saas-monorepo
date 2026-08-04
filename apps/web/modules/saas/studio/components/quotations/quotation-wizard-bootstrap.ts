import {
	applyPackageConfiguration,
	type PackageConfigurationLike,
} from "../configurations/apply-package-configuration";
import type { QuotationDraft } from "./quotation-wizard-data";

export function quotationBootstrapQueriesReady({
	bookingTypesReady,
	packageTypesReady,
	termsReady,
	termsError,
}: {
	bookingTypesReady: boolean;
	packageTypesReady: boolean;
	termsReady: boolean;
	termsError: boolean;
}): boolean {
	return bookingTypesReady && packageTypesReady && (termsReady || termsError);
}

export function applyQuotationBootstrap(
	draft: QuotationDraft,
	bookingType: { id: string; key: string; label: string },
	packageType: PackageConfigurationLike | null,
	createId: (prefix: string) => string,
): QuotationDraft {
	const first = draft.packages[0];
	if (!first) {
		return draft;
	}
	const applied = packageType ? applyPackageConfiguration(packageType) : null;
	return {
		...draft,
		quotationType: bookingType.label,
		quotationTypeId: bookingType.id,
		quotationTypeKey: bookingType.key,
		packages: applied
			? [
					{
						...first,
						configurationId: applied.configurationId,
						configurationKey: applied.configurationKey,
						configurationDefaultCost: applied.cost || null,
						configurationDescription: applied.description || null,
						name: applied.name,
						price: applied.cost,
						summary: applied.description,
						deliverables: applied.deliverables.map((item) => ({
							id: createId("deliverable"),
							name: item.name,
							quantity: String(item.quantity),
							details: item.details,
						})),
					},
				]
			: draft.packages,
	};
}
