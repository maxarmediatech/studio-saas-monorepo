import { studioProtectedProcedure } from "../../../orpc/procedures";
import { trackActivityWithExecutor } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import { withTransaction } from "../../studio/lib/transactions";
import {
	createBookingInputSchema,
	createBookingOutputSchema,
} from "../../studio/schemas/booking";
import { materializeBooking } from "../lib/materialize-booking";

export const createBooking = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/bookings",
		tags: ["Bookings"],
		summary: "Create booking",
		description:
			"Create a new booking with participants, shoots, deliverables, and payments",
	})
	.input(createBookingInputSchema)
	.output(createBookingOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "booking", "create");

		return withTransaction(async (tx) => {
			const created = await materializeBooking(
				tx,
				{
					organizationId: context.organizationId,
					organizationName: context.membership.organization.name,
					userId: context.user.id,
				},
				input,
			);

			await trackActivityWithExecutor(
				tx,
				{ organizationId: context.organizationId, user: context.user },
				{
					entityType: "booking",
					entityId: created.id,
					entityName: input.name,
					action: "created",
					metadata: {
						referenceNumber: created.referenceNumber,
						packageType: input.packageType,
						packageCost: input.packageCost,
					},
				},
			);

			return {
				data: { id: created.id },
				message: `Booking created successfully (${created.referenceNumber})`,
			};
		});
	});
