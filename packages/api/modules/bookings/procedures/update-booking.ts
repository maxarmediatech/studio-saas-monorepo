import { ORPCError } from "@orpc/server";
import { and, attachments, bookings, db, eq, isNull } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	updateBookingInputSchema,
	updateBookingOutputSchema,
} from "../../studio/schemas/booking";

export const updateBooking = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/bookings/{id}",
		tags: ["Bookings"],
		summary: "Update booking",
		description: "Update an existing booking's basic information",
	})
	.input(updateBookingInputSchema)
	.output(updateBookingOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "booking", "update");

		const {
			id,
			name,
			bookingType,
			packageType,
			packageCost,
			note,
			contractAttachment,
		} = input;

		const existing = await db.query.bookings.findFirst({
			where: and(
				eq(bookings.id, id),
				eq(bookings.organizationId, context.organizationId),
			),
		});

		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Booking not found",
			});
		}

		const updates: Partial<typeof bookings.$inferInsert> = {
			updatedAt: new Date(),
			updatedBy: context.user.id,
		};

		if (name !== undefined) {
			updates.name = name;
		}
		if (bookingType !== undefined) {
			updates.bookingType = bookingType;
		}
		if (packageType !== undefined) {
			updates.packageType = packageType;
		}
		if (packageCost !== undefined) {
			updates.packageCost = packageCost;
		}
		if (note !== undefined) {
			updates.note = note;
		}

		await db.update(bookings).set(updates).where(eq(bookings.id, id));

		if (contractAttachment !== undefined) {
			await db
				.update(attachments)
				.set({
					deletedAt: new Date(),
					deletedBy: context.user.id,
				})
				.where(
					and(
						eq(attachments.entityType, "booking"),
						eq(attachments.entityId, id),
						eq(attachments.description, "contract"),
						isNull(attachments.deletedAt),
					),
				);

			if (contractAttachment !== null) {
				const expectedPrefix = `orgs/${context.organizationId}/`;
				if (!contractAttachment.key.startsWith(expectedPrefix)) {
					throw new ORPCError("FORBIDDEN", {
						message:
							"Invalid attachment: file does not belong to this organization",
					});
				}

				await db.insert(attachments).values({
					organizationId: context.organizationId,
					entityType: "booking",
					entityId: id,
					fileName: contractAttachment.name,
					fileUrl: contractAttachment.key,
					fileSize: contractAttachment.size,
					mimeType: contractAttachment.type,
					description: "contract",
					uploadedBy: context.user.id,
				});
			}
		}

		return {
			data: { id },
			message: "Booking updated successfully",
		};
	});
