import { ORPCError } from "@orpc/server";
import { and, db, deliverables, eq, isNull, shoots, tasks } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { autoSubscribe } from "../../notifications/lib/notification-service";
import {
	subscriptionInputSchema,
	subscriptionStatusOutputSchema,
} from "../../studio/schemas/your-work";

export const subscribeToEntity = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/your-work/subscribe",
		tags: ["Your Work"],
		summary: "Subscribe to an entity",
		description: "Manually subscribe to a task, deliverable, or shoot",
	})
	.input(subscriptionInputSchema)
	.output(subscriptionStatusOutputSchema)
	.handler(async ({ input, context }) => {
		const { entityType, entityId } = input;
		const { organizationId, user } = context;

		const entityExists = await (async () => {
			switch (entityType) {
				case "task":
					return db.query.tasks.findFirst({
						where: and(
							eq(tasks.id, entityId),
							eq(tasks.organizationId, organizationId),
							isNull(tasks.deletedAt),
						),
						columns: { id: true },
					});
				case "deliverable":
					return db.query.deliverables.findFirst({
						where: and(
							eq(deliverables.id, entityId),
							eq(deliverables.organizationId, organizationId),
							isNull(deliverables.deletedAt),
						),
						columns: { id: true },
					});
				case "shoot":
					return db.query.shoots.findFirst({
						where: and(
							eq(shoots.id, entityId),
							eq(shoots.organizationId, organizationId),
							isNull(shoots.deletedAt),
						),
						columns: { id: true },
					});
				default:
					return null;
			}
		})();

		if (!entityExists) {
			throw new ORPCError("NOT_FOUND", {
				message: "Entity not found",
			});
		}

		await autoSubscribe({
			organizationId,
			userId: user.id,
			entityType,
			entityId,
		});

		return { subscribed: true };
	});
