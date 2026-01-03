import { ORPCError } from "@orpc/server";
import { and, db, deliverables, eq, isNull } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	deleteDeliverableInputSchema,
	deleteDeliverableOutputSchema,
} from "../../studio/schemas/deliverable";

export const deleteDeliverable = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/deliverables/{id}",
		tags: ["Deliverables"],
		summary: "Delete deliverable",
		description: "Soft delete a deliverable",
	})
	.input(deleteDeliverableInputSchema)
	.output(deleteDeliverableOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "deliverable", "delete");

		const { id } = input;

		// Verify deliverable exists and belongs to organization
		const deliverable = await db.query.deliverables.findFirst({
			where: and(
				eq(deliverables.id, id),
				eq(deliverables.organizationId, context.organizationId),
				isNull(deliverables.deletedAt),
			),
		});

		if (!deliverable) {
			throw new ORPCError("NOT_FOUND", {
				message: "Deliverable not found",
			});
		}

		// Soft delete
		await db
			.update(deliverables)
			.set({
				deletedAt: new Date(),
				deletedBy: context.user.id,
				updatedAt: new Date(),
				updatedBy: context.user.id,
			})
			.where(eq(deliverables.id, id));

		return {
			data: { id },
			message: "Deliverable deleted successfully",
		};
	});
