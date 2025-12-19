import { ORPCError } from "@orpc/server";
import { and, eq, crews, db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	deleteCrewInputSchema,
	deleteCrewOutputSchema,
} from "../../studio/schemas/crew";

export const deleteCrew = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/crews/{id}",
		tags: ["Crews"],
		summary: "Delete crew",
		description: "Soft delete a crew member (sets deletedAt timestamp)",
	})
	.input(deleteCrewInputSchema)
	.output(deleteCrewOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "crew", "delete");

		const { id } = input;

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

		// Check if already deleted
		if (existing.deletedAt) {
			throw new ORPCError("CONFLICT", {
				message: "Crew member is already deleted",
			});
		}

		// Soft delete crew
		await db
			.update(crews)
			.set({
				deletedAt: new Date(),
				deletedBy: context.user.id,
				updatedAt: new Date(),
				updatedBy: context.user.id,
			})
			.where(eq(crews.id, id));

		return {
			data: { id },
			message: "Crew member deleted successfully",
		};
	});
