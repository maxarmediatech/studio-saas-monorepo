import { and, db, eq, isNull, subscriptions } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	subscriptionInputSchema,
	subscriptionStatusOutputSchema,
} from "../../studio/schemas/your-work";

export const unsubscribeFromEntity = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/your-work/unsubscribe",
		tags: ["Your Work"],
		summary: "Unsubscribe from an entity",
		description: "Stop watching a task, deliverable, or shoot",
	})
	.input(subscriptionInputSchema)
	.output(subscriptionStatusOutputSchema)
	.handler(async ({ input, context }) => {
		const { entityType, entityId } = input;

		await db
			.update(subscriptions)
			.set({ deletedAt: new Date() })
			.where(
				and(
					eq(subscriptions.organizationId, context.organizationId),
					eq(subscriptions.userId, context.user.id),
					eq(subscriptions.entityType, entityType),
					eq(subscriptions.entityId, entityId),
					isNull(subscriptions.deletedAt),
				),
			);

		return { subscribed: false };
	});
