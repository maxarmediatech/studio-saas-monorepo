import { ORPCError } from "@orpc/client";
import { hasAnyRole } from "@repo/auth/lib/permissions";
import { type Config, config } from "@repo/config";
import { getOrganizationById, getOrganizationMembership } from "@repo/database";
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

type ProductCatalogEntry = {
	price: PlanPrice;
	isBundledOneTime: boolean;
	parentRecurringProductId?: string;
};

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
			const productCatalog = new Map<string, ProductCatalogEntry>();

			for (const plan of Object.values(plans)) {
				for (const price of plan.prices ?? []) {
					productCatalog.set(price.productId, {
						price,
						isBundledOneTime: false,
					});

					if (
						price.type === "recurring" &&
						price.bundledOneTimeProductId &&
						price.bundledOneTimeProductId.length > 0
					) {
						productCatalog.set(price.bundledOneTimeProductId, {
							price,
							isBundledOneTime: true,
							parentRecurringProductId: price.productId,
						});
					}
				}
			}

			const cartWithEntry = productCart.map((item) => {
				const entry = productCatalog.get(item.productId);

				if (!entry) {
					throw new ORPCError("BAD_REQUEST");
				}

				return {
					...item,
					entry,
				};
			});

			const recurringBaseProductIds = new Set(
				cartWithEntry
					.filter(
						(item) =>
							!item.entry.isBundledOneTime &&
							item.entry.price.type === "recurring",
					)
					.map((item) => item.productId),
			);

			for (const item of cartWithEntry) {
				if (
					item.entry.isBundledOneTime &&
					item.entry.parentRecurringProductId &&
					!recurringBaseProductIds.has(
						item.entry.parentRecurringProductId,
					)
				) {
					throw new ORPCError("BAD_REQUEST");
				}
			}

			const subscriptionCartItem = cartWithEntry.find(
				(item) =>
					!item.entry.isBundledOneTime &&
					item.entry.price.type === "recurring",
			);
			const trialPeriodDays =
				subscriptionCartItem &&
				"trialPeriodDays" in subscriptionCartItem.entry.price
					? subscriptionCartItem.entry.price.trialPeriodDays
					: undefined;

			const organization = organizationId
				? await getOrganizationById(organizationId)
				: undefined;

			if (organization === null) {
				throw new ORPCError("NOT_FOUND");
			}

			const resolvedProductCart = cartWithEntry.map((item) => {
				let quantity = item.quantity ?? 1;

				if (
					organization &&
					!item.entry.isBundledOneTime &&
					item.entry.price.type === "recurring" &&
					"seatBased" in item.entry.price &&
					item.entry.price.seatBased
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
				throw new ORPCError("INTERNAL_SERVER_ERROR");
			}
		},
	);
