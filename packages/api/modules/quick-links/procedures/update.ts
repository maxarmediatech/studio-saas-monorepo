import { ORPCError } from "@orpc/server";
import { and, db, eq, quickLinks } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	updateQuickLinkInputSchema,
	updateQuickLinkOutputSchema,
} from "../schemas";

export const updateQuickLink = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/quick-links/{id}",
		tags: ["Quick Links"],
		summary: "Update quick link",
		description: "Update an existing quick link",
	})
	.input(updateQuickLinkInputSchema)
	.output(updateQuickLinkOutputSchema)
	.handler(async ({ input, context }) => {
		const { organizationId, user } = context;
		const userId = user.id;

		const existing = await db
			.select()
			.from(quickLinks)
			.where(
				and(
					eq(quickLinks.id, input.id),
					eq(quickLinks.organizationId, organizationId),
					eq(quickLinks.userId, userId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "Quick link not found",
			});
		}

		const updates: Partial<typeof quickLinks.$inferInsert> = {
			updatedAt: new Date(),
		};

		if (input.url !== undefined) {
			let url = input.url.trim();
			if (!url.startsWith("http://") && !url.startsWith("https://")) {
				url = `https://${url}`;
			}
			updates.url = url;
		}

		if (input.title !== undefined) {
			updates.title = input.title.trim() || null;
		}

		const [link] = await db
			.update(quickLinks)
			.set(updates)
			.where(eq(quickLinks.id, input.id))
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
