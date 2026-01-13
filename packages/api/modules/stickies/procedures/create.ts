import { db, stickies } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { createStickyInputSchema, createStickyOutputSchema } from "../schemas";

export const createSticky = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/stickies",
		tags: ["Stickies"],
		summary: "Create sticky",
		description: "Create a new sticky note",
	})
	.input(createStickyInputSchema)
	.output(createStickyOutputSchema)
	.handler(async ({ input, context }) => {
		const { organizationId, user } = context;
		const userId = user.id;

		const [sticky] = await db
			.insert(stickies)
			.values({
				organizationId,
				userId,
				title: input.title?.trim() || null,
				content: input.content?.trim() || null,
				color: input.color,
				sortOrder: 0,
			})
			.returning();

		return {
			id: sticky.id,
			organizationId: sticky.organizationId,
			userId: sticky.userId,
			title: sticky.title,
			content: sticky.content,
			color: sticky.color,
			sortOrder: sticky.sortOrder,
			createdAt: sticky.createdAt.toISOString(),
			updatedAt: sticky.updatedAt.toISOString(),
		};
	});
