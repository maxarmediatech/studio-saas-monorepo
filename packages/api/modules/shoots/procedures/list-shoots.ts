import {
	and,
	bookings,
	count,
	crews,
	db,
	eq,
	gte,
	inArray,
	isNull,
	shootAssignments,
	shoots,
	sql,
	users,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { createPaginationResponse } from "../../studio/schemas/common";
import {
	listShootsInputSchema,
	listShootsOutputSchema,
} from "../../studio/schemas/shoot";
import { extractShootPlanningFields } from "../lib/shoot-planning";

export const listShoots = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/shoots",
		tags: ["Shoots"],
		summary: "List shoots",
		description:
			"List all shoots for the organization with optional filters",
	})
	.input(listShootsInputSchema)
	.output(listShootsOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "shoot", "list");

		const {
			bookingId,
			crewId,
			status,
			shootType,
			dateFrom,
			dateTo,
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
		const conditions = [eq(shoots.organizationId, context.organizationId)];

		if (!includeDeleted) {
			conditions.push(isNull(shoots.deletedAt));
		}

		if (bookingId) {
			conditions.push(eq(shoots.bookingId, bookingId));
		}

		const statuses = normalizeMultiValue(status);
		if (statuses) {
			conditions.push(inArray(shoots.status, statuses));
		}

		const shootTypes = normalizeMultiValue(shootType);
		if (shootTypes) {
			conditions.push(inArray(shoots.shootType, shootTypes));
		}

		if (dateFrom) {
			conditions.push(gte(shoots.shootDate, dateFrom));
		}

		if (dateTo) {
			conditions.push(sql`${shoots.shootDate} <= ${dateTo}`);
		}

		if (search) {
			conditions.push(
				sql`(${shoots.name} ILIKE ${`%${search}%`} OR ${shoots.venue} ILIKE ${`%${search}%`})`,
			);
		}

		if (crewId) {
			const assignedShootIds = await db
				.select({ shootId: shootAssignments.shootId })
				.from(shootAssignments)
				.where(eq(shootAssignments.crewId, crewId));

			const shootIds = assignedShootIds.map((r) => r.shootId);
			if (shootIds.length === 0) {
				return {
					data: [],
					pagination: createPaginationResponse(page, limit, 0),
				};
			}
			conditions.push(inArray(shoots.id, shootIds));
		}

		// Get total count
		const [countResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(shoots)
			.where(and(...conditions));

		const total = countResult?.count ?? 0;

		// Get shoots with sorting
		const orderColumn =
			sortBy === "name"
				? shoots.name
				: sortBy === "shootType"
					? shoots.shootType
					: sortBy === "status"
						? shoots.status
						: sortBy === "createdAt"
							? shoots.createdAt
							: shoots.shootDate;

		// Get shoots with booking info
		const data = await db
			.select({
				shoot: shoots,
				bookingName: bookings.name,
				bookingReferenceNumber: bookings.referenceNumber,
			})
			.from(shoots)
			.innerJoin(bookings, eq(shoots.bookingId, bookings.id))
			.where(and(...conditions))
			.orderBy(
				sortDirection === "asc"
					? sql`${orderColumn} ASC`
					: sql`${orderColumn} DESC`,
			)
			.limit(limit)
			.offset(offset);

		// Get assignment counts
		const shootIds = data.map((d) => d.shoot.id);
		const assignmentCounts: Record<string, number> = {};
		const assignedCrewByShoot: Record<
			string,
			{ id: string; name: string; avatarUrl: string | null }[]
		> = {};

		if (shootIds.length > 0) {
			const assignmentResults = await db
				.select({
					shootId: shootAssignments.shootId,
					crewId: crews.id,
					crewName: crews.name,
					avatarUrl: users.image,
				})
				.from(shootAssignments)
				.innerJoin(crews, eq(shootAssignments.crewId, crews.id))
				.leftJoin(users, eq(crews.userId, users.id))
				.where(
					and(
						inArray(shootAssignments.shootId, shootIds),
						isNull(crews.deletedAt),
					),
				);

			for (const row of assignmentResults) {
				assignmentCounts[row.shootId] =
					(assignmentCounts[row.shootId] ?? 0) + 1;
				if (!assignedCrewByShoot[row.shootId]) {
					assignedCrewByShoot[row.shootId] = [];
				}
				assignedCrewByShoot[row.shootId].push({
					id: row.crewId,
					name: row.crewName,
					avatarUrl: row.avatarUrl,
				});
			}
		}

		return {
			data: data.map(
				({ shoot, bookingName, bookingReferenceNumber }) => ({
					...shoot,
					...extractShootPlanningFields(shoot.metadata),
					createdAt: shoot.createdAt.toISOString(),
					updatedAt: shoot.updatedAt.toISOString(),
					deletedAt: shoot.deletedAt?.toISOString() ?? null,
					assignmentsCount: assignmentCounts[shoot.id] ?? 0,
					assignedCrew: assignedCrewByShoot[shoot.id] ?? [],
					bookingName,
					bookingReferenceNumber,
				}),
			),
			pagination: createPaginationResponse(page, limit, total),
		};
	});
