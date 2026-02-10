import { ORPCError } from "@orpc/server";
import { and, crews, db, eq, isNull, ne } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { detectChanges, safeTrackFieldChanges } from "../../activities/lib";
import { applySpecializationsToMetadata } from "../lib/crew-presentation";
import { requirePermission } from "../../studio/lib/permissions";
import {
	updateCrewInputSchema,
	updateCrewOutputSchema,
} from "../../studio/schemas/crew";

export const updateCrew = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/crews/{id}",
		tags: ["Crews"],
		summary: "Update crew",
		description: "Update an existing crew member",
	})
	.input(updateCrewInputSchema)
	.output(updateCrewOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "crew", "update");

		const {
			id,
			name,
			email,
			phoneNumber,
			status,
			dailyRate,
			metadata,
			specializations,
		} = input;

		// Verify crew exists and belongs to organization
		const existing = await db.query.crews.findFirst({
			where: and(
				eq(crews.id, id),
				eq(crews.organizationId, context.organizationId),
			),
		});

		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Crew member not found",
			});
		}

		// Check for duplicate phone (excluding current crew)
		if (phoneNumber !== undefined && phoneNumber !== null) {
			const duplicate = await db.query.crews.findFirst({
				where: and(
					eq(crews.organizationId, context.organizationId),
					eq(crews.phoneNumber, phoneNumber),
					isNull(crews.deletedAt),
					ne(crews.id, id),
				),
			});

			if (duplicate) {
				throw new ORPCError("CONFLICT", {
					message: `A crew member with phone number '${phoneNumber}' already exists`,
				});
			}
		}

		// Build update object
		const updates: Partial<typeof crews.$inferInsert> = {
			updatedAt: new Date(),
			updatedBy: context.user.id,
		};

		if (name !== undefined) {
			updates.name = name;
		}
		if (email !== undefined) {
			updates.email = email;
		}
		if (phoneNumber !== undefined) {
			updates.phoneNumber = phoneNumber;
		}
		if (status !== undefined) {
			updates.status = status;
		}
		if (dailyRate !== undefined) {
			updates.dailyRate = dailyRate;
		}
		if (metadata !== undefined || specializations !== undefined) {
			updates.metadata = applySpecializationsToMetadata(
				(metadata ??
					(existing.metadata as Record<string, unknown> | null)) ??
					null,
				specializations,
			);
		}

		await db.update(crews).set(updates).where(eq(crews.id, id));

		// Track activity (non-blocking)
		const changes = detectChanges(existing, input, [
			"name",
			"email",
			"phoneNumber",
			"status",
			"dailyRate",
		]);
		if (changes.length > 0) {
			await safeTrackFieldChanges(context, {
				entityType: "crew",
				entityId: id,
				entityName: input.name ?? existing.name,
				changes,
			});
		}

		return {
			data: { id },
			message: "Crew member updated successfully",
		};
	});
