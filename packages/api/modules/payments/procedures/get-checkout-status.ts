import { ORPCError } from "@orpc/client";
import { config } from "@repo/config";
import {
	getOrganizationMembership,
	getPurchasesByOrganizationId,
	getPurchasesByUserId,
} from "@repo/database";
import { logger } from "@repo/logs";
import { getCheckoutSessionStatus } from "@repo/payments";
import {
	getCheckoutStatusFromPurchases,
	sanitizeCheckoutSessionId,
} from "@repo/payments/lib/checkout";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";

export const getCheckoutStatus = protectedProcedure
	.route({
		method: "POST",
		path: "/payments/checkout-status",
		tags: ["Payments"],
		summary: "Get checkout status",
		description:
			"Returns whether the expected checkout products have become active for the current user or organization.",
	})
	.input(
		z.object({
			checkoutSessionId: z
				.string()
				.trim()
				.min(1)
				.max(200)
				.regex(/^[A-Za-z0-9_-]+$/)
				.optional(),
			organizationId: z.string().optional(),
			expectedProductIds: z.array(z.string().min(1)).optional(),
		}),
	)
	.handler(
		async ({
			input: { checkoutSessionId, organizationId, expectedProductIds },
			context: { user },
		}) => {
			let checkoutSessionPaymentStatus: string | null = null;
			let checkoutSessionPaymentId: string | null = null;

			if (checkoutSessionId) {
				const normalizedCheckoutSessionId =
					sanitizeCheckoutSessionId(checkoutSessionId);

				if (!normalizedCheckoutSessionId) {
					throw new ORPCError("BAD_REQUEST");
				}

				try {
					const checkoutSession = await getCheckoutSessionStatus(
						normalizedCheckoutSessionId,
					);
					checkoutSessionPaymentStatus =
						checkoutSession.payment_status ?? null;
					checkoutSessionPaymentId =
						checkoutSession.payment_id ?? null;
				} catch (error) {
					const status =
						typeof error === "object" &&
						error !== null &&
						"status" in error &&
						typeof error.status === "number"
							? error.status
							: null;

					if (status === 400 || status === 404 || status === 422) {
						throw new ORPCError("BAD_REQUEST");
					}

					logger.error("Failed to fetch checkout session status", {
						checkoutSessionId: normalizedCheckoutSessionId,
						error,
					});

					throw new ORPCError("INTERNAL_SERVER_ERROR");
				}
			}

			if (organizationId) {
				const membership = await getOrganizationMembership(
					organizationId,
					user.id,
				);

				if (!membership) {
					throw new ORPCError("FORBIDDEN");
				}

				const purchases =
					await getPurchasesByOrganizationId(organizationId);

				return getCheckoutStatusFromPurchases({
					checkoutSessionPaymentId,
					checkoutSessionPaymentStatus,
					purchases,
					expectedProductIds,
				});
			}

			if (
				config.organizations.enable &&
				config.organizations.enableBilling &&
				!config.users.enableBilling
			) {
				throw new ORPCError("FORBIDDEN");
			}

			const purchases = await getPurchasesByUserId(user.id);

			return getCheckoutStatusFromPurchases({
				checkoutSessionPaymentId,
				checkoutSessionPaymentStatus,
				purchases,
				expectedProductIds,
			});
		},
	);
