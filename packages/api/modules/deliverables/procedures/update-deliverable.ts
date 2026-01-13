import { ORPCError } from "@orpc/server";
import { and, db, deliverables, eq, isNull } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	detectChanges,
	safeTrackFieldChanges,
	safeTrackStatusChange,
} from "../../activities/lib";
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
		const existing = await db.query.deliverables.findFirst({
			where: and(
				eq(deliverables.id, id),
				eq(deliverables.organizationId, context.organizationId),
				isNull(deliverables.deletedAt),
			),
			with: {
				booking: {
					columns: { id: true, name: true },
				},
			},
		});

		if (!existing) {
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

		if (updates.quantity !== undefined) {
			updateData.quantity = updates.quantity;
		}

		if (updates.cost !== undefined) {
			updateData.cost = updates.cost;
		}

		if (updates.status !== undefined) {
			updateData.status = updates.status;
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

		// Track status change separately (non-blocking)
		if (updates.status !== undefined && updates.status !== existing.status) {
			await safeTrackStatusChange(
				{ organizationId: context.organizationId, user: context.user },
				{
					entityType: "deliverable",
					entityId: id,
					entityName: updates.name ?? existing.name,
					oldStatus: existing.status,
					newStatus: updates.status,
					parentEntityType: "booking",
					parentEntityId: existing.bookingId,
					parentEntityName: existing.booking.name,
				},
			);
		}

		// Track other field changes (non-blocking)
		const changes = detectChanges(
			existing,
			{ name: updates.name, description: updates.description, quantity: updates.quantity, cost: updates.cost, dueDate: updates.dueDate },
			["name", "description", "quantity", "cost", "dueDate"],
		);

		if (changes.length > 0) {
			await safeTrackFieldChanges(
				{ organizationId: context.organizationId, user: context.user },
				{
					entityType: "deliverable",
					entityId: id,
					entityName: updates.name ?? existing.name,
					parentEntityType: "booking",
					parentEntityId: existing.bookingId,
					parentEntityName: existing.booking.name,
					changes,
				},
			);
		}

		return {
			data: { id },
			message: "Deliverable updated successfully",
		};
	});
