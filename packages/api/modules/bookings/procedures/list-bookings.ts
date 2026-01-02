import {
	and,
	count,
	eq,
	inArray,
	isNull,
	sql,
	bookings,
	bookingParticipants,
	shoots,
	db,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	listBookingsInputSchema,
	listBookingsOutputSchema,
} from "../../studio/schemas/booking";
import { createPaginationResponse } from "../../studio/schemas/common";

export const listBookings = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/bookings",
		tags: ["Bookings"],
		summary: "List bookings",
		description:
			"List all bookings for the organization with optional filters",
	})
	.input(listBookingsInputSchema)
	.output(listBookingsOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "booking", "list");

		const {
			statuses,
			bookingType,
			packageType,
			search,
			sortBy,
			sortDirection,
			page,
			limit,
			includeDeleted,
		} = input;
		const offset = (page - 1) * limit;

		// Build where conditions
		const conditions = [
			eq(bookings.organizationId, context.organizationId),
		];

		if (!includeDeleted) {
			conditions.push(isNull(bookings.deletedAt));
		}

		if (statuses && statuses.length > 0) {
			conditions.push(inArray(bookings.status, statuses));
		}

		if (bookingType) {
			conditions.push(eq(bookings.bookingType, bookingType));
		}

		if (packageType) {
			conditions.push(eq(bookings.packageType, packageType));
		}

		if (search) {
			conditions.push(
				sql`(${bookings.name} ILIKE ${`%${search}%`} OR ${bookings.referenceNumber} ILIKE ${`%${search}%`})`,
			);
		}

		// Get total count
		const [countResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(bookings)
			.where(and(...conditions));

		const total = countResult?.count ?? 0;

		// Get bookings with sorting
		const orderColumn =
			sortBy === "name"
				? bookings.name
				: sortBy === "referenceNumber"
					? bookings.referenceNumber
					: sortBy === "status"
						? bookings.status
						: sortBy === "packageCost"
							? bookings.packageCost
							: sortBy === "updatedAt"
								? bookings.updatedAt
								: bookings.createdAt;

		const data = await db.query.bookings.findMany({
			where: and(...conditions),
			orderBy: (table, { asc, desc }) =>
				sortDirection === "asc"
					? [asc(orderColumn)]
					: [desc(orderColumn)],
			limit,
			offset,
		});

		// Get participant counts
		const bookingIds = data.map((b) => b.id);
		let participantCounts: Record<string, number> = {};
		let shootCounts: Record<string, number> = {};

		if (bookingIds.length > 0) {
			const participantResults = await db
				.select({
					bookingId: bookingParticipants.bookingId,
					count: count().mapWith(Number),
				})
				.from(bookingParticipants)
				.where(
					sql`${bookingParticipants.bookingId} IN (${sql.join(
						bookingIds.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				)
				.groupBy(bookingParticipants.bookingId);

			participantCounts = Object.fromEntries(
				participantResults.map((r) => [r.bookingId, r.count]),
			);

			const shootResults = await db
				.select({
					bookingId: shoots.bookingId,
					count: count().mapWith(Number),
				})
				.from(shoots)
				.where(
					and(
						sql`${shoots.bookingId} IN (${sql.join(
							bookingIds.map((id) => sql`${id}`),
							sql`, `,
						)})`,
						isNull(shoots.deletedAt),
					),
				)
				.groupBy(shoots.bookingId);

			shootCounts = Object.fromEntries(
				shootResults.map((r) => [r.bookingId, r.count]),
			);
		}

		return {
			data: data.map((booking) => {
				const packageCost = Number.parseFloat(booking.packageCost);
				const totalReceived = Number.parseFloat(booking.totalReceived);
				const balance = (packageCost - totalReceived).toFixed(2);

				return {
					...booking,
					createdAt: booking.createdAt.toISOString(),
					updatedAt: booking.updatedAt.toISOString(),
					deletedAt: booking.deletedAt?.toISOString() ?? null,
					participantsCount: participantCounts[booking.id] ?? 0,
					shootsCount: shootCounts[booking.id] ?? 0,
					balance,
				};
			}),
			pagination: createPaginationResponse(page, limit, total),
		};
	});
