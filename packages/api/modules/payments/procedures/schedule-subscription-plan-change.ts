import { ORPCError } from "@orpc/client";
import { isEnvConfigError } from "@repo/env";
import { logger } from "@repo/logs";
import {
	getSubscriptionPlanState as getSubscriptionPlanStateFn,
	scheduleSubscriptionPlanChange as scheduleSubscriptionPlanChangeFn,
} from "@repo/payments";
import {
	getConfiguredPrice,
	getServerCatalogPrice,
	resolvePurchaseIdentity,
} from "@repo/payments/lib/catalog";
import { z } from "zod";
import { localeMiddleware } from "../../../orpc/middleware/locale-middleware";
import { protectedProcedure } from "../../../orpc/procedures";
import { getManageablePurchase } from "../lib/get-manageable-purchase";

function getDodoApiErrorDetails(error: unknown): {
	status?: number;
	code?: string;
	message?: string;
} {
	if (!error || typeof error !== "object") {
		return {};
	}

	const maybeError = error as {
		status?: number;
		error?: { code?: string; message?: string };
		message?: string;
	};

	return {
		status:
			typeof maybeError.status === "number"
				? maybeError.status
				: undefined,
		code:
			typeof maybeError.error?.code === "string"
				? maybeError.error.code
				: undefined,
		message:
			typeof maybeError.error?.message === "string"
				? maybeError.error.message
				: typeof maybeError.message === "string"
					? maybeError.message
					: undefined,
	};
}

export const scheduleSubscriptionPlanChange = protectedProcedure
	.use(localeMiddleware)
	.route({
		method: "POST",
		path: "/payments/schedule-subscription-plan-change",
		tags: ["Payments"],
		summary: "Schedule a subscription plan change",
		description:
			"Schedules a monthly/yearly plan change for the next billing date without immediate proration.",
	})
	.input(
		z.object({
			purchaseId: z.string(),
			targetPriceKey: z.string().min(1),
		}),
	)
	.handler(
		async ({
			input: { purchaseId, targetPriceKey },
			context: { user },
		}) => {
			const purchase = await getManageablePurchase({
				purchaseId,
				userId: user.id,
			});

			if (
				purchase.type !== "SUBSCRIPTION" ||
				!purchase.subscriptionId ||
				purchase.status !== "active"
			) {
				throw new ORPCError("BAD_REQUEST");
			}

			const targetPrice = getConfiguredPrice(targetPriceKey);
			const targetCatalogPrice = getServerCatalogPrice(targetPriceKey);

			if (
				!(targetPrice && targetCatalogPrice) ||
				targetPrice.type !== "recurring"
			) {
				throw new ORPCError("BAD_REQUEST");
			}

			try {
				const subscription = await getSubscriptionPlanStateFn(
					purchase.subscriptionId,
				);

				if (subscription.cancelAtNextBillingDate) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"This subscription is already scheduled to cancel on its renewal date. Remove that cancellation in the billing portal before changing billing frequency.",
					});
				}

				const currentIdentity = resolvePurchaseIdentity({
					type: "SUBSCRIPTION",
					productId: subscription.productId,
					planKey: purchase.planKey,
					priceKey: purchase.priceKey,
					billingInterval: purchase.billingInterval,
					catalogVersion: purchase.catalogVersion,
				});

				if (
					currentIdentity.planKey !== "studio-basics" ||
					targetCatalogPrice.planKey !== currentIdentity.planKey ||
					currentIdentity.billingInterval ===
						targetCatalogPrice.billingInterval
				) {
					throw new ORPCError("BAD_REQUEST", {
						message: "That billing change is not available.",
					});
				}

				await scheduleSubscriptionPlanChangeFn({
					id: purchase.subscriptionId,
					productId: targetCatalogPrice.productId,
					quantity: Math.max(subscription.quantity, 1),
					effectiveAt: "next_billing_date",
					prorationBillingMode: "do_not_bill",
					onPaymentFailure: "prevent_change",
				});

				return {
					scheduledFor: subscription.nextBillingDate,
					targetPriceKey: targetCatalogPrice.priceKey,
				};
			} catch (error) {
				if (error instanceof ORPCError) {
					throw error;
				}

				const providerError = getDodoApiErrorDetails(error);

				if (
					providerError.code ===
					"PLAN_CHANGE_NOT_ALLOWED_FOR_SCHEDULED_CANCELLATION"
				) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"This subscription is already scheduled to cancel on its renewal date. Remove that cancellation in the billing portal before changing billing frequency.",
					});
				}

				if (
					providerError.code ===
					"INVALID_PRORATION_MODE_WITH_NEXT_BILLING_DATE"
				) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"Dodo does not currently allow this billing switch to be scheduled without an immediate billing adjustment.",
					});
				}

				if (
					(providerError.status === 409 ||
						providerError.status === 422) &&
					providerError.message
				) {
					throw new ORPCError("BAD_REQUEST", {
						message: providerError.message,
					});
				}

				logger.error(
					"Could not schedule subscription plan change",
					error,
				);

				if (isEnvConfigError(error)) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message:
							"Payments are not configured on this deployment.",
					});
				}

				throw new ORPCError("INTERNAL_SERVER_ERROR");
			}
		},
	);
