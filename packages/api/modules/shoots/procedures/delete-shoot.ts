import { ORPCError } from "@orpc/server";
import { and, db, eq, shoots } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	deleteShootInputSchema,
	deleteShootOutputSchema,
} from "../../studio/schemas/shoot";

export const deleteShoot = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/shoots/{id}",
		tags: ["Shoots"],
		summary: "Delete shoot",
		description: "Soft delete a shoot (sets deletedAt timestamp)",
	})
	.input(deleteShootInputSchema)
	.output(deleteShootOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "shoot", "delete");

		const { id } = input;

		// Verify shoot exists and belongs to organization
		const existing = await db.query.shoots.findFirst({
			where: and(
				eq(shoots.id, id),
				eq(shoots.organizationId, context.organizationId),
			),
		});

		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Shoot not found",
			});
		}

		// Check if already deleted
		if (existing.deletedAt) {
			throw new ORPCError("CONFLICT", {
				message: "Shoot is already deleted",
			});
		}

		// Soft delete shoot
		await db
			.update(shoots)
			.set({
				deletedAt: new Date(),
				deletedBy: context.user.id,
				updatedAt: new Date(),
				updatedBy: context.user.id,
			})
			.where(eq(shoots.id, id));

		return {
			data: { id },
			message: "Shoot deleted successfully",
		};
	});
