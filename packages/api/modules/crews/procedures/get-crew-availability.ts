import {
	and,
	crewAvailability,
	crews,
	db,
	eq,
	gte,
	isNull,
	shootAssignments,
	shoots,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getCrewAvailabilityInputSchema,
	getCrewAvailabilityOutputSchema,
} from "../../studio/schemas/crew";

export const getCrewAvailability = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/crews/availability",
		tags: ["Crews"],
		summary: "Get crew availability",
		description: "Get availability for crew members within a date range",
	})
	.input(getCrewAvailabilityInputSchema)
	.output(getCrewAvailabilityOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "crew", "list");

		const { crewIds, startDate, endDate } = input;

		// Build crew filter
		const crewConditions = [
			eq(crews.organizationId, context.organizationId),
			isNull(crews.deletedAt),
		];

		// Get target crews
		const targetCrews =
			crewIds && crewIds.length > 0
				? await db.query.crews.findMany({
						where: and(
							...crewConditions,
							sql`${crews.id} IN (${sql.join(
								crewIds.map((id) => sql`${id}`),
								sql`, `,
							)})`,
						),
						columns: { id: true, name: true },
					})
				: await db.query.crews.findMany({
						where: and(...crewConditions),
						columns: { id: true, name: true },
					});

		if (targetCrews.length === 0) {
			return { data: [] };
		}

		// Generate date range
		const dates: string[] = [];
		const start = new Date(startDate);
		const end = new Date(endDate);
		for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
			dates.push(d.toISOString().split("T")[0]);
		}

		// Get availability records for the date range
		const availabilityRecords = await db.query.crewAvailability.findMany({
			where: and(
				sql`${crewAvailability.crewId} IN (${sql.join(
					targetCrews.map((c) => sql`${c.id}`),
					sql`, `,
				)})`,
				gte(crewAvailability.date, startDate),
				sql`${crewAvailability.date} <= ${endDate}`,
			),
		});

		// Get shoot assignments for the date range
		const shootAssignmentsData = await db
			.select({
				crewId: shootAssignments.crewId,
				shootDate: shoots.shootDate,
			})
			.from(shootAssignments)
			.innerJoin(shoots, eq(shootAssignments.shootId, shoots.id))
			.where(
				and(
					sql`${shootAssignments.crewId} IN (${sql.join(
						targetCrews.map((c) => sql`${c.id}`),
						sql`, `,
					)})`,
					eq(shoots.organizationId, context.organizationId),
					isNull(shoots.deletedAt),
					gte(shoots.shootDate, startDate),
					sql`${shoots.shootDate} <= ${endDate}`,
				),
			);

		// Build availability map per crew
		const availabilityMap = new Map<
			string,
			Map<string, { isAvailable: boolean; reason: string | null }>
		>();
		for (const record of availabilityRecords) {
			if (!availabilityMap.has(record.crewId)) {
				availabilityMap.set(record.crewId, new Map());
			}
			availabilityMap.get(record.crewId)!.set(record.date, {
				isAvailable: record.isAvailable,
				reason: record.reason,
			});
		}

		// Build shoot assignment map per crew
		const shootMap = new Map<string, Set<string>>();
		for (const assignment of shootAssignmentsData) {
			if (!assignment.shootDate) continue;
			if (!shootMap.has(assignment.crewId)) {
				shootMap.set(assignment.crewId, new Set());
			}
			shootMap.get(assignment.crewId)!.add(assignment.shootDate);
		}

		// Build response
		const result = targetCrews.map((crew) => {
			const crewAvailabilityMap = availabilityMap.get(crew.id);
			const crewShootDates = shootMap.get(crew.id);

			return {
				crewId: crew.id,
				crewName: crew.name,
				availability: dates.map((date) => {
					const availability = crewAvailabilityMap?.get(date);
					const hasShoot = crewShootDates?.has(date) ?? false;

					return {
						date,
						isAvailable: availability?.isAvailable ?? true,
						reason: availability?.reason ?? null,
						hasShootAssignment: hasShoot,
					};
				}),
			};
		});

		return { data: result };
	});
