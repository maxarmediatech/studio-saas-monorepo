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
		requirePermission(context, "booking", "list");

		const {
			statuses,
			bookingType,
			packageType,
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

		// Date range filter: comma-separated "from,to" dates
		// Parse YYYY-MM-DD explicitly and apply UTC day boundaries for deterministic filtering.
		if (createdAt) {
			const parseDate = (dateStr: string): Date | null => {
				const trimmed = dateStr.trim();
				if (!trimmed) {
					return null;
				}

				// Parse YYYY-MM-DD format explicitly to avoid timezone issues
				const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
				if (match) {
					const year = Number.parseInt(match[1] ?? "", 10);
					const month = Number.parseInt(match[2] ?? "", 10);
					const day = Number.parseInt(match[3] ?? "", 10);
					if (
						Number.isNaN(year) ||
						Number.isNaN(month) ||
						Number.isNaN(day)
					) {
						return null;
					}
					return new Date(Date.UTC(year, month - 1, day));
				}

				// Fallback for other formats
				const date = new Date(trimmed);
				return Number.isNaN(date.getTime()) ? null : date;
			};

			const parts = createdAt.split(",");
			const fromDate = parseDate(parts[0] ?? "");
			const toDate = parseDate(parts[1] ?? "");

			if (fromDate) {
				fromDate.setUTCHours(0, 0, 0, 0);
				conditions.push(gte(bookings.createdAt, fromDate));
			}
			if (toDate) {
				toDate.setUTCHours(23, 59, 59, 999);
				conditions.push(lte(bookings.createdAt, toDate));
			}
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
					balance,
				};
			}),
			pagination: createPaginationResponse(page, limit, total),
		};
	});
