import {
	and,
	eq,
	isNull,
	gte,
	sql,
	count,
	asc,
	desc,
	ne,
	shoots,
	bookings,
	shootAssignments,
	crews,
	db,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { createPaginationResponse } from "../../studio/schemas/common";
import {
	getMyShootsInputSchema,
	getMyShootsOutputSchema,
} from "../../studio/schemas/my-assignments";
import { getMyCrewId } from "../lib/get-my-crew";

export const getMyShoots = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/me/assignments/shoots",
		tags: ["My Assignments"],
		summary: "Get my shoots",
		description: "Get shoot assignments for the current crew member",
	})
	.input(getMyShootsInputSchema)
	.output(getMyShootsOutputSchema)
	.handler(async ({ input, context }) => {
		const {
			page,
			limit,
			sortBy,
			sortDirection,
			dateFrom,
			dateTo,
			status,
			bookingId,
			includeCompleted,
		} = input;

		const offset = (page - 1) * limit;

		// Get crew ID for current user
		const crewId = await getMyCrewId(context.user.id, context.organizationId);

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const todayStr = today.toISOString().split("T")[0];

		// Build where conditions
		const conditions = [
			eq(shootAssignments.crewId, crewId),
			eq(shoots.organizationId, context.organizationId),
			isNull(shoots.deletedAt),
		];

		if (dateFrom) {
			conditions.push(gte(shoots.shootDate, dateFrom));
		}

		if (dateTo) {
			conditions.push(sql`${shoots.shootDate} <= ${dateTo}`);
		}

		if (status) {
			conditions.push(eq(shoots.status, status));
		}

		if (bookingId) {
			conditions.push(eq(shoots.bookingId, bookingId));
		}

		if (!includeCompleted) {
			// By default, show future shoots only
			conditions.push(gte(shoots.shootDate, todayStr));
		}

		// Sorting
		const sortColumnMap = {
			shootDate: shoots.shootDate,
			createdAt: shoots.createdAt,
		};
		const sortColumn = sortColumnMap[sortBy as keyof typeof sortColumnMap] ?? shoots.shootDate;
		const orderBy = sortDirection === "asc" ? asc(sortColumn) : desc(sortColumn);

		// Get assignments with shoot info
		const assignmentsList = await db
			.select({
				assignmentId: shootAssignments.id,
				role: shootAssignments.role,
				isLead: shootAssignments.isLead,
				shootId: shoots.id,
				name: shoots.name,
				shootDate: shoots.shootDate,
				startTime: shoots.startTime,
				endTime: shoots.endTime,
				venue: shoots.venue,
				status: shoots.status,
				bookingId: shoots.bookingId,
			})
			.from(shootAssignments)
			.innerJoin(shoots, eq(shootAssignments.shootId, shoots.id))
			.where(and(...conditions))
			.orderBy(orderBy)
			.limit(limit)
			.offset(offset);

		// Get total count
		const [countResult] = await db
			.select({ count: count() })
			.from(shootAssignments)
			.innerJoin(shoots, eq(shootAssignments.shootId, shoots.id))
			.where(and(...conditions));

		const total = countResult?.count ?? 0;

		// Enrich with booking info and other crew
		const enrichedAssignments = await Promise.all(
			assignmentsList.map(async (assignment) => {
				// Get booking info
				const booking = await db.query.bookings.findFirst({
					where: eq(bookings.id, assignment.bookingId),
					columns: {
						id: true,
						name: true,
						referenceNumber: true,
						status: true,
					},
				});

				// Get other crew on this shoot
				const otherCrew = await db
					.select({
						crewId: shootAssignments.crewId,
						role: shootAssignments.role,
						isLead: shootAssignments.isLead,
						name: crews.name,
					})
					.from(shootAssignments)
					.innerJoin(crews, eq(shootAssignments.crewId, crews.id))
					.where(
						and(
							eq(shootAssignments.shootId, assignment.shootId),
							ne(shootAssignments.crewId, crewId),
						),
					);

				return {
					id: assignment.assignmentId,
					shootId: assignment.shootId,
					title: assignment.name,
					shootDate: assignment.shootDate,
					startTime: assignment.startTime,
					endTime: assignment.endTime,
					location: assignment.venue,
					status: assignment.status,
					role: assignment.role,
					isLead: assignment.isLead,
					booking: {
						id: booking?.id ?? "",
						name: booking?.name ?? "Unknown",
						referenceNumber: booking?.referenceNumber ?? "",
						status: booking?.status ?? "new",
					},
					otherCrew: otherCrew.map((c) => ({
						id: c.crewId,
						name: c.name,
						role: c.role,
						isLead: c.isLead,
					})),
				};
			}),
		);

		return {
			data: enrichedAssignments,
			pagination: createPaginationResponse(page, limit, total),
		};
	});
