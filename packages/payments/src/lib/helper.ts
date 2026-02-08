import { type Config, config } from "@repo/config";
import type { PurchaseSchema } from "@repo/database";
import type { z } from "zod";

const plans = config.payments.plans as Config["payments"]["plans"];
const bundledOneTimeProductIds = new Set(
	Object.values(plans).flatMap((plan) =>
		(plan.prices ?? []).flatMap((price) =>
			price.type === "recurring" && price.bundledOneTimeProductId
				? [price.bundledOneTimeProductId]
				: [],
		),
	),
);

type PlanId = keyof typeof config.payments.plans;
type PurchaseRecord = z.infer<typeof PurchaseSchema>;

const activeSubscriptionStatuses = new Set(["active", "trialing"]);
const inactiveOneTimeStatuses = new Set(["failed", "cancelled"]);

function sortByNewest(a: PurchaseRecord, b: PurchaseRecord) {
	const aTime = a.updatedAt ?? a.createdAt;
	const bTime = b.updatedAt ?? b.createdAt;
	return bTime.getTime() - aTime.getTime();
}

function getActivePlanFromPurchases(purchases?: PurchaseRecord[]) {
	const sortedPurchases = [...(purchases ?? [])].sort(sortByNewest);

	const subscriptionPurchase = sortedPurchases.find(
		(purchase) =>
			purchase.type === "SUBSCRIPTION" &&
			activeSubscriptionStatuses.has(
				(purchase.status ?? "").toLowerCase(),
			),
	);
	const oneTimePurchase = sortedPurchases.find(
		(purchase) =>
			purchase.type === "ONE_TIME" &&
			!inactiveOneTimeStatuses.has(
				(purchase.status ?? "").toLowerCase(),
			) &&
			!bundledOneTimeProductIds.has(purchase.productId),
	);
	const hasActivePurchase = Boolean(subscriptionPurchase || oneTimePurchase);

	if (subscriptionPurchase) {
		const plan = Object.entries(plans).find(([_, plan]) =>
			plan.prices?.some(
				(price) => price.productId === subscriptionPurchase.productId,
			),
		);

		return {
			id: plan?.[0] as PlanId,
			price: plan?.[1].prices?.find(
				(price) => price.productId === subscriptionPurchase.productId,
			),
			status: subscriptionPurchase.status,
			purchaseId: subscriptionPurchase.id,
			hasActivePurchase,
		};
	}

	if (oneTimePurchase) {
		const plan = Object.entries(plans).find(([_, plan]) =>
			plan.prices?.some(
				(price) => price.productId === oneTimePurchase.productId,
			),
		);

		return {
			id: plan?.[0] as PlanId,
			price: plan?.[1].prices?.find(
				(price) => price.productId === oneTimePurchase.productId,
			),
			status: oneTimePurchase.status || "active",
			purchaseId: oneTimePurchase.id,
			hasActivePurchase,
		};
	}

	const freePlan = Object.entries(plans).find(([_, plan]) => plan.isFree);

	return freePlan
		? {
				id: freePlan[0] as PlanId,
				status: "active",
				hasActivePurchase,
			}
		: null;
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
		return !!purchases?.some((purchase) =>
			Object.entries(plans)
				.find(([id]) => id === planId)?.[1]
				.prices?.some(
					(price) => price.productId === purchase.productId,
				),
		);
	};

	return { activePlan, hasSubscription, hasPurchase };
}
