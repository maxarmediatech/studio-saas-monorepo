import { ORPCError } from "@orpc/server";
import { and, db, eq, stickies } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	type StickyColor,
	updateStickyInputSchema,
	updateStickyOutputSchema,
} from "../schemas";

export const updateSticky = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/stickies/{id}",
		tags: ["Stickies"],
		summary: "Update sticky",
		description: "Update an existing sticky note",
	})
	.input(updateStickyInputSchema)
	.output(updateStickyOutputSchema)
	.handler(async ({ input, context }) => {
		const { organizationId, user } = context;
		const userId = user.id;

		const existing = await db
			.select()
			.from(stickies)
			.where(
				and(
					eq(stickies.id, input.id),
					eq(stickies.organizationId, organizationId),
					eq(stickies.userId, userId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "Sticky not found",
			});
		}

		const updates: Partial<typeof stickies.$inferInsert> = {
			updatedAt: new Date(),
		};

		if (input.title !== undefined) {
			updates.title = input.title.trim() || null;
		}

		if (input.content !== undefined) {
			updates.content = input.content.trim() || null;
		}

		if (input.color !== undefined) {
			updates.color = input.color;
		}

		if (input.descriptionHtml !== undefined) {
			updates.descriptionHtml = input.descriptionHtml || null;
		}

		const [sticky] = await db
			.update(stickies)
			.set(updates)
			.where(eq(stickies.id, input.id))
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
