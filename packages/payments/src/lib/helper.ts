import { type Config, config } from "@repo/config";
import type { PurchaseSchema } from "@repo/database";
import type { z } from "zod";

const plans = config.payments.plans as Config["payments"]["plans"];
type PlanId = Extract<keyof typeof plans, string>;
type PurchaseRecord = z.infer<typeof PurchaseSchema>;
type PlanPrice = {
	priceKey: string;
	amount: number;
	currency: string;
	hidden?: boolean;
	introOfferAmount?: number;
	type: "recurring" | "one-time";
	interval?: "month" | "year" | "week";
	intervalCount?: number;
	seatBased?: boolean;
};

const activeSubscriptionStatuses = new Set(["active", "trialing"]);
const configuredPricesByKey = new Map<
	string,
	{
		planId: PlanId;
		price: PlanPrice;
	}
>();

for (const [planId, plan] of Object.entries(plans) as Array<
	[PlanId, (typeof plans)[PlanId]]
>) {
	for (const price of plan.prices ?? []) {
		configuredPricesByKey.set(price.priceKey, {
			planId,
			price,
		});
	}
}

function sortByNewest(a: PurchaseRecord, b: PurchaseRecord) {
	const aTime = a.updatedAt ?? a.createdAt;
	const bTime = b.updatedAt ?? b.createdAt;
	return bTime.getTime() - aTime.getTime();
}

function getConfiguredPlanForPurchase(purchase: PurchaseRecord) {
	if (purchase.priceKey) {
		const matchedPrice = configuredPricesByKey.get(purchase.priceKey);
		if (matchedPrice) {
			return matchedPrice;
		}
	}

	if (purchase.planKey && purchase.planKey in plans) {
		return {
			planId: purchase.planKey as PlanId,
			price:
				(plans[purchase.planKey as PlanId].prices ?? []).find(
					(price: PlanPrice) => price.priceKey === purchase.priceKey,
				) ?? null,
		};
	}

	return null;
}

function getActivePlanFromPurchases(purchases?: PurchaseRecord[]) {
	const sortedPurchases = [...(purchases ?? [])].sort(sortByNewest);

	const subscriptionPurchase = sortedPurchases.find(
		(purchase) =>
			purchase.type === "SUBSCRIPTION" &&
			activeSubscriptionStatuses.has(
				(purchase.status ?? "").toLowerCase(),
			) &&
			getConfiguredPlanForPurchase(purchase),
	);
	const hasActivePurchase = Boolean(subscriptionPurchase);

	if (subscriptionPurchase) {
		const matchedPlan = getConfiguredPlanForPurchase(subscriptionPurchase);

		return {
			id: matchedPlan?.planId as PlanId,
			price: matchedPlan?.price ?? null,
			status: subscriptionPurchase.status,
			purchaseId: subscriptionPurchase.id,
			hasActivePurchase,
		};
	}

	return null;
}

export function createPurchasesHelper(purchases: PurchaseRecord[]) {
	const activePlan = getActivePlanFromPurchases(purchases);

	const hasSubscription = (planIds?: PlanId[] | PlanId) => {
		return (
			!!activePlan &&
			(Array.isArray(planIds)
				? planIds.includes(activePlan.id)
				: planIds === activePlan.id)
		);
	};

	const hasPurchase = (planId: PlanId) => {
		return !!purchases?.some(
			(purchase) =>
				getConfiguredPlanForPurchase(purchase)?.planId === planId,
		);
	};

	return { activePlan, hasSubscription, hasPurchase };
}
