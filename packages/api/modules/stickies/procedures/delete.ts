import { ORPCError } from "@orpc/server";
import { and, db, eq, stickies } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { deleteStickyInputSchema, deleteStickyOutputSchema } from "../schemas";

export const deleteSticky = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/stickies/{id}",
		tags: ["Stickies"],
		summary: "Delete sticky",
		description: "Delete a sticky note",
	})
	.input(deleteStickyInputSchema)
	.output(deleteStickyOutputSchema)
	.handler(async ({ input, context }) => {
		const { organizationId, user } = context;
		const userId = user.id;

		const result = await db
			.delete(stickies)
			.where(
				and(
					eq(stickies.id, input.id),
					eq(stickies.organizationId, organizationId),
					eq(stickies.userId, userId),
				),
			)
			.returning({ id: stickies.id });

		if (result.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "Sticky not found",
			});
		}

		return { success: true };
	});
