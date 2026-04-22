import {
	and,
	bookingParticipants,
	bookings,
	clients,
	count,
	db,
	eq,
	gte,
	inArray,
	isNull,
	lte,
	shoots,
	sql,
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
		await requirePermission(context, "booking", "list");

		const {
			clientId,
			statuses,
			bookingType,
			packageType,
			bookingDate,
			createdAt,
			search,
			sortBy,
			sortDirection,
			page,
			limit,
			includeDeleted,
		} = input;
		const offset = (page - 1) * limit;

		const normalizeMultiValue = (
			value: string | string[] | null | undefined,
		): string[] | null => {
			if (!value) {
				return null;
			}

			const raw = Array.isArray(value) ? value : [value];
			const parts = raw
				.flatMap((v) => v.split(","))
				.map((v) => v.trim())
				.filter(Boolean);

			return parts.length > 0 ? parts : null;
		};

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

		const bookingTypes = normalizeMultiValue(bookingType);
		if (bookingTypes) {
			conditions.push(inArray(bookings.bookingType, bookingTypes));
		}

		const packageTypes = normalizeMultiValue(packageType);
		if (packageTypes) {
			conditions.push(inArray(bookings.packageType, packageTypes));
		}

		// Booking date range filter: comma-separated "from,to" dates.
		// `createdAt` is kept as a backwards-compatible alias for older URLs/saved views.
		const bookingDateRange = bookingDate ?? createdAt;
		if (bookingDateRange) {
			const parseDateString = (dateStr: string): string | null => {
				const trimmed = dateStr.trim();
				if (!trimmed) {
					return null;
				}

				return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
			};

			const parts = bookingDateRange.split(",");
			const fromDate = parseDateString(parts[0] ?? "");
			const toDate = parseDateString(parts[1] ?? "");

			if (fromDate) {
				conditions.push(gte(bookings.bookingDate, fromDate));
			}
			if (toDate) {
				conditions.push(lte(bookings.bookingDate, toDate));
			}
		}

		if (search) {
			conditions.push(
				sql`(${bookings.name} ILIKE ${`%${search}%`} OR ${bookings.referenceNumber} ILIKE ${`%${search}%`})`,
			);
		}

		if (clientId) {
			const clientBookings = await db
				.select({ bookingId: bookingParticipants.bookingId })
				.from(bookingParticipants)
				.where(eq(bookingParticipants.clientId, clientId));

			const bookingIds = clientBookings.map((r) => r.bookingId);
			if (bookingIds.length === 0) {
				return {
					data: [],
					pagination: createPaginationResponse(page, limit, 0),
				};
			}
			conditions.push(inArray(bookings.id, bookingIds));
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
							: sortBy === "bookingDate"
								? bookings.bookingDate
								: sortBy === "updatedAt"
									? bookings.updatedAt
									: bookings.createdAt;

		const data = await db.query.bookings.findMany({
			where: and(...conditions),
			orderBy: (_table, { asc, desc }) =>
				sortDirection === "asc"
					? [asc(orderColumn)]
					: [desc(orderColumn)],
			limit,
			offset,
		});

		// Get participant counts and data, and shoot counts
		const bookingIds = data.map((b) => b.id);
		const participantsByBooking: Record<
			string,
			{ id: string; role: string; client: { id: string; name: string } }[]
		> = {};
		let shootCounts: Record<string, number> = {};
		let weddingDates: Record<string, string> = {};

		if (bookingIds.length > 0) {
			// Fetch participants with client data
			const participantResults = await db
				.select({
					id: bookingParticipants.id,
					bookingId: bookingParticipants.bookingId,
					role: bookingParticipants.role,
					clientId: clients.id,
					clientName: clients.name,
				})
				.from(bookingParticipants)
				.innerJoin(
					clients,
					eq(bookingParticipants.clientId, clients.id),
				)
				.where(inArray(bookingParticipants.bookingId, bookingIds));

			// Group participants by booking
			for (const row of participantResults) {
				if (!participantsByBooking[row.bookingId]) {
					participantsByBooking[row.bookingId] = [];
				}
				participantsByBooking[row.bookingId].push({
					id: row.id,
					role: row.role,
					client: {
						id: row.clientId,
						name: row.clientName,
					},
				});
			}

			const shootResults = await db
				.select({
					bookingId: shoots.bookingId,
					count: count().mapWith(Number),
				})
				.from(shoots)
				.where(
					and(
						inArray(shoots.bookingId, bookingIds),
						isNull(shoots.deletedAt),
					),
				)
				.groupBy(shoots.bookingId);

			shootCounts = Object.fromEntries(
				shootResults.map((r) => [r.bookingId, r.count]),
			);

			const weddingShootResults = await db
				.select({
					bookingId: shoots.bookingId,
					weddingDate: sql<string>`MIN(${shoots.shootDate})`,
				})
				.from(shoots)
				.where(
					and(
						inArray(shoots.bookingId, bookingIds),
						eq(shoots.shootType, "wedding"),
						isNull(shoots.deletedAt),
					),
				)
				.groupBy(shoots.bookingId);

			weddingDates = Object.fromEntries(
				weddingShootResults
					.filter((r) => r.weddingDate)
					.map((r) => [r.bookingId, r.weddingDate]),
			);
		}

		return {
			data: data.map((booking) => {
				const packageCost = Number.parseFloat(booking.packageCost);
				const totalReceived = Number.parseFloat(booking.totalReceived);
				const balance = (packageCost - totalReceived).toFixed(2);
				const participants = participantsByBooking[booking.id] ?? [];

				return {
					...booking,
					createdAt: booking.createdAt.toISOString(),
					updatedAt: booking.updatedAt.toISOString(),
					deletedAt: booking.deletedAt?.toISOString() ?? null,
					participantsCount: participants.length,
					participants,
					shootsCount: shootCounts[booking.id] ?? 0,
					weddingDate:
						booking.bookingType === "wedding"
							? (weddingDates[booking.id] ?? null)
							: null,
					balance,
				};
			}),
			pagination: createPaginationResponse(page, limit, total),
		};
	});
