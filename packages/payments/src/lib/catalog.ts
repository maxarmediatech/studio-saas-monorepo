import { type Config, config } from "@repo/config";

export const PAYMENT_CATALOG_VERSION = "2026-04-basics" as const;
export const LEGACY_UNKNOWN_PLAN_KEY = "legacy-unknown" as const;

const knownPaymentCatalog = {
	"studio-basics-monthly": {
		priceKey: "studio-basics-monthly",
		planKey: "studio-basics",
		billingInterval: "month",
		productId: process.env.DODO_PRODUCT_ID_STUDIO_BASICS_MONTHLY ?? "",
	},
	"studio-basics-yearly": {
		priceKey: "studio-basics-yearly",
		planKey: "studio-basics",
		billingInterval: "year",
		productId: process.env.DODO_PRODUCT_ID_STUDIO_BASICS_YEARLY ?? "",
	},
} as const;

const knownCollectionCatalog = {
	"studio-basics": {
		planKey: "studio-basics",
		productCollectionId:
			process.env.DODO_PRODUCT_COLLECTION_ID_STUDIO_BASICS ?? "",
		expectedPriceKeys: [
			"studio-basics-monthly",
			"studio-basics-yearly",
		] as const,
	},
} as const;

export type KnownPriceKey = keyof typeof knownPaymentCatalog;
export type KnownPlanKey =
	| (typeof knownPaymentCatalog)[KnownPriceKey]["planKey"]
	| "studio-advance";
export type PriceKey = KnownPriceKey | string;
export type PlanKey = KnownPlanKey | string;
export type BillingInterval = "month" | "year" | "one_time";
type ClientPlanPrice = {
	priceKey: string;
	amount: number;
	currency: string;
	hidden?: boolean;
	type: "recurring" | "one-time";
	interval?: "month" | "year" | "week";
	intervalCount?: number;
	seatBased?: boolean;
};

type PurchaseLike = {
	type: "SUBSCRIPTION" | "ONE_TIME";
	productId: string;
	planKey?: string | null;
	priceKey?: string | null;
	billingInterval?: string | null;
	catalogVersion?: string | null;
};

const clientPlans = config.payments.plans as Config["payments"]["plans"];

function isNonEmptyString(value: string | null | undefined): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function normalizeBillingInterval(
	value: string | null | undefined,
): BillingInterval | null {
	return value === "month" || value === "year" || value === "one_time"
		? value
		: null;
}

export function getKnownPaymentCatalog() {
	return knownPaymentCatalog;
}

export function getServerCatalogPrice(priceKey: string) {
	return knownPaymentCatalog[priceKey as KnownPriceKey] ?? null;
}

export function getServerCatalogPlan(planKey: string) {
	return (
		knownCollectionCatalog[
			planKey as keyof typeof knownCollectionCatalog
		] ?? null
	);
}

export function findCatalogPriceByProductId(productId: string) {
	return Object.values(knownPaymentCatalog).find(
		(price) => price.productId === productId,
	);
}

export function getConfiguredPlan(planKey: string) {
	return clientPlans[planKey];
}

export function getConfiguredPrice(priceKey: string) {
	for (const plan of Object.values(clientPlans)) {
		for (const price of plan.prices ?? []) {
			if (price.priceKey === priceKey) {
				return price as ClientPlanPrice;
			}
		}
	}

	return null;
}

export function resolvePurchaseIdentity(purchase: PurchaseLike) {
	const mappedCurrentPrice = isNonEmptyString(purchase.productId)
		? findCatalogPriceByProductId(purchase.productId)
		: null;
	const normalizedPlanKey = isNonEmptyString(purchase.planKey)
		? purchase.planKey
		: null;
	const normalizedPriceKey = isNonEmptyString(purchase.priceKey)
		? purchase.priceKey
		: null;
	const normalizedBillingInterval = normalizeBillingInterval(
		purchase.billingInterval,
	);

	if (
		mappedCurrentPrice &&
		(!normalizedPriceKey ||
			normalizedPriceKey !== mappedCurrentPrice.priceKey ||
			!normalizedPlanKey ||
			normalizedPlanKey !== mappedCurrentPrice.planKey ||
			normalizedBillingInterval !== mappedCurrentPrice.billingInterval)
	) {
		return {
			planKey: mappedCurrentPrice.planKey,
			priceKey: mappedCurrentPrice.priceKey,
			billingInterval: mappedCurrentPrice.billingInterval,
			catalogVersion: purchase.catalogVersion ?? PAYMENT_CATALOG_VERSION,
		};
	}

	return {
		planKey: normalizedPlanKey ?? LEGACY_UNKNOWN_PLAN_KEY,
		priceKey:
			normalizedPriceKey ??
			(isNonEmptyString(purchase.productId)
				? purchase.productId
				: LEGACY_UNKNOWN_PLAN_KEY),
		billingInterval:
			normalizedBillingInterval ??
			(purchase.type === "ONE_TIME" ? "one_time" : null),
		catalogVersion: purchase.catalogVersion ?? PAYMENT_CATALOG_VERSION,
	};
}

export function hydratePurchaseIdentity<T extends PurchaseLike>(purchase: T) {
	return {
		...purchase,
		...resolvePurchaseIdentity(purchase),
	};
}
