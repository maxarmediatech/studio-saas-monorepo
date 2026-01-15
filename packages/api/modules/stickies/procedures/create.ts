import { db, stickies } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	createStickyInputSchema,
	createStickyOutputSchema,
	type StickyColor,
} from "../schemas";

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
				descriptionHtml: input.descriptionHtml || null,
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
			descriptionHtml: sticky.descriptionHtml,
			color: sticky.color as StickyColor,
			sortOrder: sticky.sortOrder,
			createdAt: sticky.createdAt.toISOString(),
			updatedAt: sticky.updatedAt.toISOString(),
		};
	});
