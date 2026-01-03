import { ORPCError } from "@orpc/server";
import { and, db, eq, shoots } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	updateShootInputSchema,
	updateShootOutputSchema,
} from "../../studio/schemas/shoot";

export const updateShoot = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/shoots/{id}",
		tags: ["Shoots"],
		summary: "Update shoot",
		description: "Update an existing shoot",
	})
	.input(updateShootInputSchema)
	.output(updateShootOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "shoot", "update");

		const {
			id,
			name,
			shootType,
			shootDate,
			startTime,
			endTime,
			venue,
			venueAddress,
			notes,
			status,
		} = input;

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

		// Build update object
		const updates: Partial<typeof shoots.$inferInsert> = {
			updatedAt: new Date(),
			updatedBy: context.user.id,
		};

		if (name !== undefined) updates.name = name;
		if (shootType !== undefined) updates.shootType = shootType;
		if (shootDate !== undefined) updates.shootDate = shootDate;
		if (startTime !== undefined) updates.startTime = startTime;
		if (endTime !== undefined) updates.endTime = endTime;
		if (venue !== undefined) updates.venue = venue;
		if (venueAddress !== undefined) updates.venueAddress = venueAddress;
		if (notes !== undefined) updates.notes = notes;
		if (status !== undefined) updates.status = status;

		await db.update(shoots).set(updates).where(eq(shoots.id, id));

		return {
			data: { id },
			message: "Shoot updated successfully",
		};
	});
