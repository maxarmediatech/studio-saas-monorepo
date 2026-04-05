import { ORPCError } from "@orpc/client";
import { isEnvConfigError } from "@repo/env";
import { logger } from "@repo/logs";
import { createCustomerPortalLink as createCustomerPortalLinkFn } from "@repo/payments";
import { z } from "zod";
import { localeMiddleware } from "../../../orpc/middleware/locale-middleware";
import { protectedProcedure } from "../../../orpc/procedures";
import { getManageablePurchase } from "../lib/get-manageable-purchase";

export const createCustomerPortalLink = protectedProcedure
	.use(localeMiddleware)
	.route({
		method: "POST",
		path: "/payments/create-customer-portal-link",
		tags: ["Payments"],
		summary: "Create customer portal link",
		description:
			"Creates a customer portal link for the customer or team. If a purchase is provided, the link will be created for the customer of the purchase.",
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

		try {
			const customerPortalLink = await createCustomerPortalLinkFn({
				subscriptionId: purchase.subscriptionId ?? undefined,
				customerId: purchase.customerId,
			});

			if (!customerPortalLink) {
				throw new ORPCError("INTERNAL_SERVER_ERROR");
			}

			return { customerPortalLink };
		} catch (e) {
			logger.error("Could not create customer portal link", e);
			if (isEnvConfigError(e)) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Payments are not configured on this deployment.",
				});
			}
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
