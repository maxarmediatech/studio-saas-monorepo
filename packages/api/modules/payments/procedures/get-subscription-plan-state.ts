import { ORPCError } from "@orpc/client";
import { isEnvConfigError } from "@repo/env";
import { logger } from "@repo/logs";
import { getSubscriptionPlanState as getSubscriptionPlanStateFn } from "@repo/payments";
import { resolvePurchaseIdentity } from "@repo/payments/lib/catalog";
import { z } from "zod";
import { localeMiddleware } from "../../../orpc/middleware/locale-middleware";
import { protectedProcedure } from "../../../orpc/procedures";
import { getManageablePurchase } from "../lib/get-manageable-purchase";

export const getSubscriptionPlanState = protectedProcedure
	.use(localeMiddleware)
	.route({
		method: "POST",
		path: "/payments/get-subscription-plan-state",
		tags: ["Payments"],
		summary: "Get subscription plan state",
		description:
			"Returns the live subscription billing interval and any scheduled plan change.",
	})
	.input(
		z.object({
			purchaseId: z.string(),
		}),
	)
	.handler(async ({ input: { purchaseId }, context: { user } }) => {
		const purchase = await getManageablePurchase({
			purchaseId,
			userId: user.id,
		});

		if (purchase.type !== "SUBSCRIPTION" || !purchase.subscriptionId) {
			throw new ORPCError("BAD_REQUEST");
		}

		try {
			const subscription = await getSubscriptionPlanStateFn(
				purchase.subscriptionId,
			);
			const currentIdentity = resolvePurchaseIdentity({
				type: "SUBSCRIPTION",
				productId: subscription.productId,
				planKey: purchase.planKey,
				priceKey: purchase.priceKey,
				billingInterval: purchase.billingInterval,
				catalogVersion: purchase.catalogVersion,
			});
			const scheduledIdentity = subscription.scheduledChange
				? resolvePurchaseIdentity({
						type: "SUBSCRIPTION",
						productId: subscription.scheduledChange.productId,
						planKey: purchase.planKey,
						priceKey: null,
						billingInterval: null,
						catalogVersion: purchase.catalogVersion,
					})
				: null;

			return {
				subscriptionId: subscription.subscriptionId,
				status: subscription.status,
				currentPlanKey: currentIdentity.planKey,
				currentPriceKey: currentIdentity.priceKey,
				currentBillingInterval: currentIdentity.billingInterval,
				cancelAtNextBillingDate: subscription.cancelAtNextBillingDate,
				nextBillingDate: subscription.nextBillingDate,
				scheduledChange:
					subscription.scheduledChange && scheduledIdentity
						? {
								id: subscription.scheduledChange.id,
								planKey: scheduledIdentity.planKey,
								priceKey: scheduledIdentity.priceKey,
								billingInterval:
									scheduledIdentity.billingInterval,
								effectiveAt:
									subscription.scheduledChange.effectiveAt,
							}
						: null,
			};
		} catch (error) {
			logger.error("Could not retrieve subscription plan state", error);

			if (isEnvConfigError(error)) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Payments are not configured on this deployment.",
				});
			}

			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
