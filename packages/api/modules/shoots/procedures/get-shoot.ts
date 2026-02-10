import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	crews,
	db,
	eq,
	shootAssignments,
	shoots,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getShootInputSchema,
	getShootOutputSchema,
} from "../../studio/schemas/shoot";

export const getShoot = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/shoots/{id}",
		tags: ["Shoots"],
		summary: "Get shoot",
		description:
			"Get a single shoot by ID with assignments and booking info",
	})
	.input(getShootInputSchema)
	.output(getShootOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "shoot", "read");

		const { id } = input;

		// Get shoot with organization scope
		const shoot = await db.query.shoots.findFirst({
			where: and(
				eq(shoots.id, id),
				eq(shoots.organizationId, context.organizationId),
			),
		});

		if (!shoot) {
			throw new ORPCError("NOT_FOUND", {
				message: "Shoot not found",
			});
		}

		// Get booking info
		const booking = await db.query.bookings.findFirst({
			where: eq(bookings.id, shoot.bookingId),
			columns: {
				id: true,
				name: true,
				referenceNumber: true,
			},
		});

		if (!booking) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Booking not found for shoot",
			});
		}

		// Get assignments with crew info
		const assignments = await db
			.select({
				id: shootAssignments.id,
				shootId: shootAssignments.shootId,
				crewId: shootAssignments.crewId,
				role: shootAssignments.role,
				isLead: shootAssignments.isLead,
				rate: shootAssignments.rate,
				assignedBy: shootAssignments.assignedBy,
				createdAt: shootAssignments.createdAt,
				crew: {
					id: crews.id,
					name: crews.name,
					phoneNumber: crews.phoneNumber,
				},
			})
			.from(shootAssignments)
			.innerJoin(crews, eq(shootAssignments.crewId, crews.id))
			.where(eq(shootAssignments.shootId, id));

		return {
			data: {
				...shoot,
				createdAt: shoot.createdAt.toISOString(),
				updatedAt: shoot.updatedAt.toISOString(),
				deletedAt: shoot.deletedAt?.toISOString() ?? null,
				assignments: assignments.map((a) => ({
					...a,
					rate: a.rate,
					createdAt: a.createdAt.toISOString(),
				})),
				booking,
			},
		};
	});
