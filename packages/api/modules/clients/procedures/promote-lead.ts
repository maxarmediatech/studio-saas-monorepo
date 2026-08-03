import { ORPCError } from "@orpc/server";
import { and, clients, db, eq } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	promoteLeadInputSchema,
	promoteLeadOutputSchema,
} from "../../studio/schemas/client";

export const promoteLead = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/clients/{id}/promote",
		tags: ["Clients"],
		summary: "Promote a lead to client",
	})
	.input(promoteLeadInputSchema)
	.output(promoteLeadOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "client", "update");
		const [promoted] = await db
			.update(clients)
			.set({
				lifecycleStage: "client",
				updatedAt: new Date(),
				updatedBy: context.user.id,
			})
			.where(
				and(
					eq(clients.id, input.id),
					eq(clients.organizationId, context.organizationId),
					eq(clients.lifecycleStage, "lead"),
				),
			)
			.returning({ id: clients.id, name: clients.name });
		if (!promoted) {
			throw new ORPCError("NOT_FOUND", { message: "Lead not found" });
		}
		await safeTrackActivity(context, {
			entityType: "client",
			entityId: promoted.id,
			entityName: promoted.name,
			action: "updated",
			metadata: {
				lifecycleStage: "client",
				previousLifecycleStage: "lead",
			},
		});
		return {
			data: { id: promoted.id },
			message: "Lead promoted to client",
		};
	});
