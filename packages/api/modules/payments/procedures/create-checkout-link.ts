import { ORPCError } from "@orpc/client";
import { hasAnyRole } from "@repo/auth/lib/permissions";
import { type Config, config } from "@repo/config";
import { getOrganizationById, getOrganizationMembership } from "@repo/database";
import { isEnvConfigError } from "@repo/env";
import { logger } from "@repo/logs";
import {
	createCheckoutLink as createCheckoutLinkFn,
	getCustomerIdFromEntity,
} from "@repo/payments";
import { z } from "zod";
import { localeMiddleware } from "../../../orpc/middleware/locale-middleware";
import { protectedProcedure } from "../../../orpc/procedures";

const checkoutCartItemSchema = z.object({
	productId: z.string().min(1),
	quantity: z.number().int().positive().optional(),
});

type PlanPrice = NonNullable<
	Config["payments"]["plans"][string]["prices"]
>[number];

export const createCheckoutLink = protectedProcedure
	.use(localeMiddleware)
	.route({
		method: "POST",
		path: "/payments/create-checkout-link",
		tags: ["Payments"],
		summary: "Create checkout link",
		description: "Creates a checkout link for one or more products",
	})
	.input(
		z.object({
			productCart: z.array(checkoutCartItemSchema).min(1),
			redirectUrl: z.string().optional(),
			organizationId: z.string().optional(),
		}),
	)
	.handler(
		async ({
			input: { productCart, redirectUrl, organizationId },
			context: { user },
		}) => {
			if (
				config.organizations.enable &&
				config.organizations.enableBilling &&
				!config.users.enableBilling &&
				!organizationId
			) {
				throw new ORPCError("FORBIDDEN");
			}

			if (organizationId) {
				const membership = await getOrganizationMembership(
					organizationId,
					user.id,
				);

				if (!membership || !hasAnyRole(membership.role, ["owner"])) {
					throw new ORPCError("FORBIDDEN");
				}
			}

			const customerId = await getCustomerIdFromEntity(
				organizationId
					? {
							organizationId,
						}
					: {
							userId: user.id,
						},
			);

			const plans = config.payments.plans as Config["payments"]["plans"];
			const basePricesByProductId = new Map<string, PlanPrice>();
			const bundledParentMap = new Map<string, Set<string>>();

			for (const plan of Object.values(plans)) {
				for (const price of plan.prices ?? []) {
					basePricesByProductId.set(price.productId, price);

					if (
						price.type === "recurring" &&
						price.bundledOneTimeProductId &&
						price.bundledOneTimeProductId.length > 0
					) {
						const existingParents =
							bundledParentMap.get(
								price.bundledOneTimeProductId,
							) ?? new Set<string>();
						existingParents.add(price.productId);
						bundledParentMap.set(
							price.bundledOneTimeProductId,
							existingParents,
						);
					}
				}
			}

			const allowedProductIds = new Set<string>([
				...basePricesByProductId.keys(),
				...bundledParentMap.keys(),
			]);

			const cartWithContext = productCart.map((item) => {
				const isAllowed = allowedProductIds.has(item.productId);

				if (!isAllowed) {
					throw new ORPCError("BAD_REQUEST");
				}

				return {
					...item,
					basePrice: basePricesByProductId.get(item.productId),
					bundledParents: bundledParentMap.get(item.productId),
				};
			});

			const recurringBaseProductIds = new Set(
				cartWithContext
					.filter((item) => item.basePrice?.type === "recurring")
					.map((item) => item.productId),
			);

			for (const item of cartWithContext) {
				const bundledParents = item.bundledParents;
				if (!(bundledParents && bundledParents.size > 0)) {
					continue;
				}

				const hasMatchingParent = [...bundledParents].some(
					(parentProductId) =>
						recurringBaseProductIds.has(parentProductId),
				);

				if (!hasMatchingParent) {
					throw new ORPCError("BAD_REQUEST");
				}
			}

			const subscriptionCartItem = cartWithContext.find(
				(item) => item.basePrice?.type === "recurring",
			);
			const subscriptionBasePrice = subscriptionCartItem?.basePrice;
			const trialPeriodDays =
				subscriptionBasePrice &&
				"trialPeriodDays" in subscriptionBasePrice
					? subscriptionBasePrice.trialPeriodDays
					: undefined;

			const organization = organizationId
				? await getOrganizationById(organizationId)
				: undefined;

			if (organization === null) {
				throw new ORPCError("NOT_FOUND");
			}

			const resolvedProductCart = cartWithContext.map((item) => {
				let quantity = item.quantity ?? 1;

				if (
					organization &&
					item.basePrice?.type === "recurring" &&
					"seatBased" in item.basePrice &&
					item.basePrice.seatBased
				) {
					quantity = Math.max(organization.members.length, 1);
				}

				return {
					productId: item.productId,
					quantity,
				};
			});

			try {
				const checkoutLink = await createCheckoutLinkFn({
					productCart: resolvedProductCart,
					email: user.email,
					name: user.name ?? "",
					redirectUrl,
					...(organizationId
						? { organizationId }
						: { userId: user.id }),
					trialPeriodDays,
					customerId: customerId ?? undefined,
				});

				if (!checkoutLink) {
					throw new ORPCError("INTERNAL_SERVER_ERROR");
				}

				return { checkoutLink };
			} catch (e) {
				logger.error(e);
				if (isEnvConfigError(e)) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message:
							"Payments are not configured on this deployment.",
					});
				}
				throw new ORPCError("INTERNAL_SERVER_ERROR");
			}
		},
	);
