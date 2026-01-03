import { ORPCError } from "@orpc/client";
import { config } from "@repo/config";
import {
	getOrganizationMembership,
	getPurchasesByOrganizationId,
	getPurchasesByUserId,
} from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";

export const listPurchases = protectedProcedure
	.route({
		method: "POST",
		path: "/payments/purchases",
		tags: ["Payments"],
		summary: "Get purchases",
		description:
			"Get all purchases of the current user or the provided organization",
	})
	.input(
		z.object({
			organizationId: z.string().optional(),
		}),
	)
	.handler(async ({ input: { organizationId }, context: { user } }) => {
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

			return { purchases };
		}

		if (
			config.organizations.enable &&
			config.organizations.enableBilling &&
			!config.users.enableBilling
		) {
			throw new ORPCError("FORBIDDEN");
		}

		const purchases = await getPurchasesByUserId(user.id);

		return { purchases };
	});
