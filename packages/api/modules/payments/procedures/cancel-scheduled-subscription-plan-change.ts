import { ORPCError } from "@orpc/client";
import { isEnvConfigError } from "@repo/env";
import { logger } from "@repo/logs";
import {
	cancelScheduledSubscriptionPlanChange as cancelScheduledSubscriptionPlanChangeFn,
	getSubscriptionPlanState as getSubscriptionPlanStateFn,
} from "@repo/payments";
import { z } from "zod";
import { localeMiddleware } from "../../../orpc/middleware/locale-middleware";
import { protectedProcedure } from "../../../orpc/procedures";
import { getManageablePurchase } from "../lib/get-manageable-purchase";

export const cancelScheduledSubscriptionPlanChange = protectedProcedure
	.use(localeMiddleware)
	.route({
		method: "POST",
		path: "/payments/cancel-scheduled-subscription-plan-change",
		tags: ["Payments"],
		summary: "Cancel a scheduled subscription plan change",
		description:
			"Cancels a pending monthly/yearly switch before the next renewal.",
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

			if (!subscription.scheduledChange) {
				return { canceled: false };
			}

			await cancelScheduledSubscriptionPlanChangeFn(
				purchase.subscriptionId,
			);

			return { canceled: true };
		} catch (error) {
			logger.error(
				"Could not cancel scheduled subscription plan change",
				error,
			);

			if (isEnvConfigError(error)) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Payments are not configured on this deployment.",
				});
			}

			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
