import { and, bookings, db, eq, isNull, sql } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requireAnyPermission } from "../../studio/lib/permissions";
import {
	listBookingsMinimalInputSchema,
	listBookingsMinimalOutputSchema,
} from "../../studio/schemas/booking";

export const listBookingsMinimal = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/bookings/minimal",
		tags: ["Bookings"],
		summary: "List bookings (minimal)",
		description:
			"Lightweight list of bookings for dropdowns and references",
	})
	.input(listBookingsMinimalInputSchema)
	.output(listBookingsMinimalOutputSchema)
	.handler(async ({ input, context }) => {
		await requireAnyPermission(context, [
			{ resource: "booking", action: "list" },
			{ resource: "booking", action: "reference" },
		]);

		const { status, search } = input;

		// Build where conditions
		const conditions = [
			eq(bookings.organizationId, context.organizationId),
			isNull(bookings.deletedAt),
		];

		if (status) {
			conditions.push(eq(bookings.status, status));
		}

		if (search) {
			conditions.push(
				sql`(${bookings.name} ILIKE ${`%${search}%`} OR ${bookings.referenceNumber} ILIKE ${`%${search}%`})`,
			);
		}

		const data = await db.query.bookings.findMany({
			where: and(...conditions),
			columns: {
				id: true,
				referenceNumber: true,
				name: true,
				status: true,
				packageType: true,
			},
			orderBy: (table, { desc }) => [desc(table.bookingDate)],
			limit: 100,
		});

		return { data };
	});
