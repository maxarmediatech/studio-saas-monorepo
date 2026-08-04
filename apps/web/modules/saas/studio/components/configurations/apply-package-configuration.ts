import { PACKAGE_DELIVERABLE_TEMPLATES } from "./package-deliverable-templates";

export type PackageConfigurationLike = {
	id: string;
	key: string;
	label: string;
	defaultCost: string | null;
	description: string | null;
	metadata: Record<string, unknown> | null;
};

export function configurationControlMode(input: {
	isPending: boolean;
	isError: boolean;
	optionCount: number;
}): "loading" | "error" | "configured" | "freeText" {
	if (input.isPending) {
		return "loading";
	}
	if (input.isError) {
		return "error";
	}
	return input.optionCount > 0 ? "configured" : "freeText";
}

export function packageMatchesBookingType(
	configuration: PackageConfigurationLike & {
		bookingTypeFilter?: string | null;
	},
	bookingType: { key: string | null; label: string },
): boolean {
	const metadataFilter = (
		configuration.metadata as {
			bookingType?: string;
		} | null
	)?.bookingType;
	const filter = configuration.bookingTypeFilter ?? metadataFilter;
	return (
		!filter || filter === bookingType.key || filter === bookingType.label
	);
}

export function selectQuotationBootstrap<
	TBooking extends { isDefault: boolean },
	TPackage extends PackageConfigurationLike & {
		isDefault: boolean;
		bookingTypeFilter?: string | null;
	},
>(
	bookingTypes: TBooking[],
	packageTypes: TPackage[],
): { bookingType: TBooking; packageType: TPackage | null } | null {
	const bookingType = bookingTypes.find((item) => item.isDefault);
	if (!bookingType || !("key" in bookingType) || !("label" in bookingType)) {
		return null;
	}
	const identity = bookingType as TBooking & { key: string; label: string };
	return {
		bookingType,
		packageType:
			packageTypes.find(
				(item) =>
					item.isDefault && packageMatchesBookingType(item, identity),
			) ?? null,
	};
}

export function applyPackageConfiguration(
	configuration: PackageConfigurationLike,
) {
	const metadata = configuration.metadata as {
		defaultCost?: string;
		defaultDeliverables?: Array<{
			title: string;
			quantity: number | string;
			details?: string | null;
		}>;
	} | null;
	const defaultDeliverables = Array.isArray(metadata?.defaultDeliverables)
		? metadata.defaultDeliverables
		: PACKAGE_DELIVERABLE_TEMPLATES;
	return {
		configurationId: configuration.id,
		configurationKey: configuration.key,
		name: configuration.label,
		cost: configuration.defaultCost ?? metadata?.defaultCost ?? "",
		description: configuration.description ?? "",
		deliverables: defaultDeliverables.map((item) => ({
			name: item.title,
			quantity: Number(item.quantity) || 1,
			details: "details" in item ? (item.details ?? "") : "",
		})),
	};
}
