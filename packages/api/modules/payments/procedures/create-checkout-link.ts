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
import {
	getConfiguredPrice,
	getServerCatalogPlan,
	getServerCatalogPrice,
} from "@repo/payments/lib/catalog";
import { z } from "zod";
import { localeMiddleware } from "../../../orpc/middleware/locale-middleware";
import { protectedProcedure } from "../../../orpc/procedures";

export const createCheckoutLink = protectedProcedure
	.use(localeMiddleware)
	.route({
		method: "POST",
		path: "/payments/create-checkout-link",
		tags: ["Payments"],
		summary: "Create checkout link",
		description: "Creates a checkout link for a configured price key",
	})
	.input(
		z.object({
			priceKey: z.string().min(1),
			postCheckoutPath: z.string().optional(),
			organizationId: z.string().optional(),
		}),
	)
	.handler(
		async ({
			input: { priceKey, postCheckoutPath, organizationId },
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
			const price = getConfiguredPrice(priceKey);
			const catalogPrice = getServerCatalogPrice(priceKey);
			const collectionPlan = catalogPrice
				? getServerCatalogPlan(catalogPrice.planKey)
				: null;

			if (!(price && catalogPrice)) {
				throw new ORPCError("BAD_REQUEST");
			}

			const plan = (config.payments.plans as Config["payments"]["plans"])[
				catalogPrice.planKey
			];

			if (plan?.comingSoon || price.type !== "recurring") {
				throw new ORPCError("BAD_REQUEST");
			}

			const expectedPriceKeys = collectionPlan?.expectedPriceKeys?.length
				? [...collectionPlan.expectedPriceKeys]
				: [catalogPrice.priceKey];
			const collectionCatalogProducts = expectedPriceKeys.map(
				(expectedKey) => getServerCatalogPrice(expectedKey),
			);

			if (
				collectionPlan &&
				(!collectionPlan.productCollectionId ||
					collectionCatalogProducts.some(
						(product) => !product?.productId,
					))
			) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message:
						"Payments collection catalog is not configured correctly.",
				});
			}
			if (
				!(collectionPlan?.productCollectionId || catalogPrice.productId)
			) {
				throw new ORPCError("BAD_REQUEST");
			}

			const organization = organizationId
				? await getOrganizationById(organizationId)
				: undefined;

			if (organization === null) {
				throw new ORPCError("NOT_FOUND");
			}

			let quantity = 1;

			if (organization && "seatBased" in price && price.seatBased) {
				quantity = Math.max(organization.members.length, 1);
			}

			try {
				const { checkoutLink, checkoutSessionId } =
					await createCheckoutLinkFn({
						priceKey,
						productId: catalogPrice.productId || undefined,
						productCollectionId:
							collectionPlan?.productCollectionId || undefined,
						quantity,
						expectedPriceKeys,
						email: user.email,
						name: user.name ?? "",
						postCheckoutPath,
						...(organizationId
							? { organizationId }
							: { userId: user.id }),
						customerId: customerId ?? undefined,
					});

				if (!checkoutLink) {
					throw new ORPCError("INTERNAL_SERVER_ERROR");
				}

				return {
					checkoutLink,
					checkoutSessionId,
					requiresHostedCheckout: Boolean(
						collectionPlan?.productCollectionId,
					),
				};
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
