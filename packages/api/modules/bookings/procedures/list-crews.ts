import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	crews,
	db,
	deliverableAssignments,
	deliverables,
	eq,
	isNull,
	shootAssignments,
	shoots,
	taskAssignments,
	tasks,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	type BookingCrewMember,
	type CrewAssignmentSource,
	listBookingCrewsInputSchema,
	listBookingCrewsOutputSchema,
} from "../../studio/schemas/booking";

export const listBookingCrews = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/bookings/{bookingId}/crews",
		tags: ["Bookings", "Crews"],
		summary: "List booking crews",
		description:
			"Get all crew members assigned to a booking through shoots, tasks, and deliverables",
	})
	.input(listBookingCrewsInputSchema)
	.output(listBookingCrewsOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "booking", "read");

		const { bookingId } = input;

		// Verify booking exists and belongs to organization
		const booking = await db.query.bookings.findFirst({
			where: and(
				eq(bookings.id, bookingId),
				eq(bookings.organizationId, context.organizationId),
				isNull(bookings.deletedAt),
			),
			columns: { id: true },
		});

		if (!booking) {
			throw new ORPCError("NOT_FOUND", {
				message: "Booking not found",
			});
		}

		// Get all shoots for this booking
		const bookingShoots = await db.query.shoots.findMany({
			where: and(
				eq(shoots.bookingId, bookingId),
				isNull(shoots.deletedAt),
			),
			columns: { id: true, name: true, shootType: true },
		});

		// Get all tasks for this booking
		const bookingTasks = await db.query.tasks.findMany({
			where: and(eq(tasks.bookingId, bookingId), isNull(tasks.deletedAt)),
			columns: { id: true, name: true },
		});

		// Get all deliverables for this booking
		const bookingDeliverables = await db.query.deliverables.findMany({
			where: and(
				eq(deliverables.bookingId, bookingId),
				isNull(deliverables.deletedAt),
			),
			columns: { id: true, name: true },
		});

		// Create lookup maps for entity names
		const shootNameMap = new Map(
			bookingShoots.map((s) => [s.id, s.name || s.shootType || "Unnamed Shoot"]),
		);
		const taskNameMap = new Map(
			bookingTasks.map((t) => [t.id, t.name || "Unnamed Task"]),
		);
		const deliverableNameMap = new Map(
			bookingDeliverables.map((d) => [d.id, d.name || "Unnamed Deliverable"]),
		);

		// Get crew assignments from shoots
		const shootCrewAssignments =
			bookingShoots.length > 0
				? await db
						.select({
							crewId: shootAssignments.crewId,
							entityId: shootAssignments.shootId,
						})
						.from(shootAssignments)
						.where(
							and(
								eq(shootAssignments.shootId, bookingShoots[0]?.id ?? ""),
								...bookingShoots.slice(1).map((s) =>
									eq(shootAssignments.shootId, s.id),
								),
							),
						)
				: [];

		// Actually, let me fetch all assignments properly
		const shootIds = bookingShoots.map((s) => s.id);
		const taskIds = bookingTasks.map((t) => t.id);
		const deliverableIds = bookingDeliverables.map((d) => d.id);

		// Aggregate all crew assignments
		const crewAssignmentsMap = new Map<string, CrewAssignmentSource[]>();

		// Fetch shoot assignments
		if (shootIds.length > 0) {
			const shootAssignmentRows = await db
				.select({
					crewId: shootAssignments.crewId,
					shootId: shootAssignments.shootId,
				})
				.from(shootAssignments)
				.innerJoin(shoots, eq(shootAssignments.shootId, shoots.id))
				.where(
					and(
						eq(shoots.bookingId, bookingId),
						isNull(shoots.deletedAt),
					),
				);

			for (const row of shootAssignmentRows) {
				const existing = crewAssignmentsMap.get(row.crewId) || [];
				existing.push({
					type: "shoot",
					id: row.shootId,
					name: shootNameMap.get(row.shootId) || "Unnamed Shoot",
				});
				crewAssignmentsMap.set(row.crewId, existing);
			}
		}

		// Fetch task assignments
		if (taskIds.length > 0) {
			const taskAssignmentRows = await db
				.select({
					crewId: taskAssignments.crewId,
					taskId: taskAssignments.taskId,
				})
				.from(taskAssignments)
				.innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
				.where(
					and(eq(tasks.bookingId, bookingId), isNull(tasks.deletedAt)),
				);

			for (const row of taskAssignmentRows) {
				const existing = crewAssignmentsMap.get(row.crewId) || [];
				existing.push({
					type: "task",
					id: row.taskId,
					name: taskNameMap.get(row.taskId) || "Unnamed Task",
				});
				crewAssignmentsMap.set(row.crewId, existing);
			}
		}

		// Fetch deliverable assignments
		if (deliverableIds.length > 0) {
			const deliverableAssignmentRows = await db
				.select({
					crewId: deliverableAssignments.crewId,
					deliverableId: deliverableAssignments.deliverableId,
				})
				.from(deliverableAssignments)
				.innerJoin(
					deliverables,
					eq(deliverableAssignments.deliverableId, deliverables.id),
				)
				.where(
					and(
						eq(deliverables.bookingId, bookingId),
						isNull(deliverables.deletedAt),
					),
				);

			for (const row of deliverableAssignmentRows) {
				const existing = crewAssignmentsMap.get(row.crewId) || [];
				existing.push({
					type: "deliverable",
					id: row.deliverableId,
					name:
						deliverableNameMap.get(row.deliverableId) ||
						"Unnamed Deliverable",
				});
				crewAssignmentsMap.set(row.crewId, existing);
			}
		}

		// Get unique crew IDs
		const crewIds = Array.from(crewAssignmentsMap.keys());

		if (crewIds.length === 0) {
			return { data: [] };
		}

		// Fetch crew details
		const crewDetails = await db.query.crews.findMany({
			where: and(
				eq(crews.organizationId, context.organizationId),
				isNull(crews.deletedAt),
			),
			columns: {
				id: true,
				name: true,
				role: true,
				phoneNumber: true,
				email: true,
			},
		});

		// Filter to only crews that are assigned
		const crewDetailsMap = new Map(crewDetails.map((c) => [c.id, c]));

		// Build response
		const data: BookingCrewMember[] = crewIds
			.map((crewId) => {
				const crew = crewDetailsMap.get(crewId);
				if (!crew) return null;

				return {
					id: crew.id,
					name: crew.name,
					role: crew.role,
					phoneNumber: crew.phoneNumber,
					email: crew.email,
					assignments: crewAssignmentsMap.get(crewId) || [],
				};
			})
			.filter((c): c is BookingCrewMember => c !== null);

		return { data };
	});
