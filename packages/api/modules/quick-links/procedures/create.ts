import { db, quickLinks } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	createQuickLinkInputSchema,
	createQuickLinkOutputSchema,
} from "../schemas";

export const createQuickLink = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/quick-links",
		tags: ["Quick Links"],
		summary: "Create quick link",
		description: "Create a new quick link for the current user",
	})
	.input(createQuickLinkInputSchema)
	.output(createQuickLinkOutputSchema)
	.handler(async ({ input, context }) => {
		const { organizationId, user } = context;
		const userId = user.id;

		let url = input.url.trim();
		if (!url.startsWith("http://") && !url.startsWith("https://")) {
			url = `https://${url}`;
		}

		const [link] = await db
			.insert(quickLinks)
			.values({
				organizationId,
				userId,
				url,
				title: input.title?.trim() || null,
				sortOrder: 0,
			})
			.returning();

		return {
			id: link.id,
			organizationId: link.organizationId,
			userId: link.userId,
			title: link.title,
			url: link.url,
			metadata: link.metadata as Record<string, unknown> | null,
			sortOrder: link.sortOrder,
			createdAt: link.createdAt.toISOString(),
			updatedAt: link.updatedAt.toISOString(),
		};
	});
