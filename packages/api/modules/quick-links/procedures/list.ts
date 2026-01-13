import { and, asc, db, eq, quickLinks } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	listQuickLinksInputSchema,
	listQuickLinksOutputSchema,
} from "../schemas";

export const listQuickLinks = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/quick-links",
		tags: ["Quick Links"],
		summary: "List quick links",
		description: "Get user's quick links for the current organization",
	})
	.input(listQuickLinksInputSchema)
	.output(listQuickLinksOutputSchema)
	.handler(async ({ context }) => {
		const { organizationId, user } = context;
		const userId = user.id;

		const links = await db
			.select()
			.from(quickLinks)
			.where(
				and(
					eq(quickLinks.organizationId, organizationId),
					eq(quickLinks.userId, userId),
				),
			)
			.orderBy(asc(quickLinks.sortOrder), asc(quickLinks.createdAt));

		const data = links.map((link) => ({
			id: link.id,
			organizationId: link.organizationId,
			userId: link.userId,
			title: link.title,
			url: link.url,
			metadata: link.metadata as Record<string, unknown> | null,
			sortOrder: link.sortOrder,
			createdAt: link.createdAt.toISOString(),
			updatedAt: link.updatedAt.toISOString(),
		}));

		return { data };
	});
