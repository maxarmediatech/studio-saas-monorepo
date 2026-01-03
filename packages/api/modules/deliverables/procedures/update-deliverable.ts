import { ORPCError } from "@orpc/server";
import { and, db, deliverables, eq, isNull } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	updateDeliverableInputSchema,
	updateDeliverableOutputSchema,
} from "../../studio/schemas/deliverable";

export const updateDeliverable = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/deliverables/{id}",
		tags: ["Deliverables"],
		summary: "Update deliverable",
		description: "Update an existing deliverable",
	})
	.input(updateDeliverableInputSchema)
	.output(updateDeliverableOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "deliverable", "update");

		const { id, ...updates } = input;

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

		// Build update object (only include non-undefined values)
		const updateData: Record<string, unknown> = {
			updatedAt: new Date(),
			updatedBy: context.user.id,
		};

		if (updates.name !== undefined) {
			updateData.name = updates.name;
		}

		if (updates.description !== undefined) {
			updateData.description = updates.description;
		}

		if (updates.deliverableType !== undefined) {
			updateData.deliverableType = updates.deliverableType;
		}

		if (updates.status !== undefined) {
			updateData.status = updates.status;
		}

		if (updates.priority !== undefined) {
			updateData.priority = updates.priority;
		}

		if (updates.dueDate !== undefined) {
			updateData.dueDate = updates.dueDate;
		}

		if (updates.metadata !== undefined) {
			updateData.metadata = updates.metadata;
		}

		// Update deliverable
		await db
			.update(deliverables)
			.set(updateData)
			.where(eq(deliverables.id, id));

		return {
			data: { id },
			message: "Deliverable updated successfully",
		};
	});
