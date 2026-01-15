import { and, db, eq, isNull, subscriptions } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	subscriptionInputSchema,
	subscriptionStatusOutputSchema,
} from "../../studio/schemas/your-work";

export const getSubscriptionStatus = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/your-work/subscription-status",
		tags: ["Your Work"],
		summary: "Get subscription status",
		description: "Check if the current user is subscribed to an entity",
	})
	.input(subscriptionInputSchema)
	.output(subscriptionStatusOutputSchema)
	.handler(async ({ input, context }) => {
		const { entityType, entityId } = input;

		const existing = await db.query.subscriptions.findFirst({
			where: and(
				eq(subscriptions.organizationId, context.organizationId),
				eq(subscriptions.userId, context.user.id),
				eq(subscriptions.entityType, entityType),
				eq(subscriptions.entityId, entityId),
				isNull(subscriptions.deletedAt),
			),
			columns: { id: true },
		});

		return { subscribed: Boolean(existing) };
	});
