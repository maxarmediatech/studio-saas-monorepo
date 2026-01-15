import { and, db, desc, eq, stickies } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	listStickiesInputSchema,
	listStickiesOutputSchema,
	type StickyColor,
} from "../schemas";

export const listStickies = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/stickies",
		tags: ["Stickies"],
		summary: "List stickies",
		description: "Get user's stickies for the current organization",
	})
	.input(listStickiesInputSchema)
	.output(listStickiesOutputSchema)
	.handler(async ({ context, input }) => {
		const { organizationId, user } = context;
		const userId = user.id;
		const { limit } = input;

		const query = db
			.select()
			.from(stickies)
			.where(
				and(
					eq(stickies.organizationId, organizationId),
					eq(stickies.userId, userId),
				),
			)
			.orderBy(desc(stickies.createdAt), desc(stickies.id));

		const items = limit ? await query.limit(limit) : await query;

		const data = items.map((item) => ({
			id: item.id,
			organizationId: item.organizationId,
			userId: item.userId,
			title: item.title,
			content: item.content,
			descriptionHtml: item.descriptionHtml,
			color: item.color as StickyColor,
			sortOrder: item.sortOrder,
			createdAt: item.createdAt.toISOString(),
			updatedAt: item.updatedAt.toISOString(),
		}));

		return { data };
	});
