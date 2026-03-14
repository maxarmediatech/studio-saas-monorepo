import {
	and,
	asc,
	count,
	crews,
	db,
	desc,
	eq,
	ilike,
	inArray,
	isNull,
	members,
	or,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { createPaginationResponse } from "../../studio/schemas/common";
import {
	listCrewsInputSchema,
	listCrewsOutputSchema,
} from "../../studio/schemas/crew";
import {
	deriveCrewRoles,
	extractSpecializations,
} from "../lib/crew-presentation";

export const listCrews = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/crews",
		tags: ["Crews"],
		summary: "List crews",
		description:
			"List all crew members for the organization with optional filters",
	})
	.input(listCrewsInputSchema)
	.output(listCrewsOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "crew", "list");

		const {
			status,
			specializations,
			workerType,
			hasAppAccess,
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
		const conditions = [eq(crews.organizationId, context.organizationId)];

		if (!includeDeleted) {
			conditions.push(isNull(crews.deletedAt));
		}

		const statuses = normalizeMultiValue(status);
		if (statuses) {
			conditions.push(inArray(crews.status, statuses));
		}

		const specializationFilters = normalizeMultiValue(specializations);
		if (specializationFilters) {
			const matchAnySpecialization = specializationFilters.map(
				(tag) => sql`${crews.metadata}->'specializations' ? ${tag}`,
			);
			const specializationCondition = or(...matchAnySpecialization);
			if (specializationCondition) {
				conditions.push(specializationCondition);
			}
		}

		const workerTypeFilters = normalizeMultiValue(workerType);
		if (workerTypeFilters) {
			conditions.push(
				inArray(
					crews.workerType,
					workerTypeFilters.filter(
						(value): value is "internal" | "freelancer" =>
							value === "internal" || value === "freelancer",
					),
				),
			);
		}

		const accessFilters = normalizeMultiValue(hasAppAccess);
		if (accessFilters?.length === 1) {
			const membershipExists = sql`exists (
				select 1
				from ${members}
				where ${members.organizationId} = ${crews.organizationId}
					and ${members.userId} = ${crews.userId}
			)`;
			conditions.push(
				accessFilters[0] === "true"
					? membershipExists
					: sql`not (${membershipExists})`,
			);
		}

		if (search) {
			conditions.push(ilike(crews.name, `%${search}%`));
		}

		// Get total count
		const [countResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(crews)
			.where(and(...conditions));

		const total = countResult?.count ?? 0;

		// Get crews with sorting
		const orderColumn =
			sortBy === "name"
				? crews.name
				: sortBy === "status"
					? crews.status
					: sortBy === "updatedAt"
						? crews.updatedAt
						: crews.createdAt;

		const data = await db
			.select({
				id: crews.id,
				organizationId: crews.organizationId,
				userId: crews.userId,
				name: crews.name,
				email: crews.email,
				phoneNumber: crews.phoneNumber,
				workerType: crews.workerType,
				status: crews.status,
				dailyRate: crews.dailyRate,
				metadata: crews.metadata,
				createdBy: crews.createdBy,
				updatedBy: crews.updatedBy,
				createdAt: crews.createdAt,
				updatedAt: crews.updatedAt,
				deletedAt: crews.deletedAt,
				deletedBy: crews.deletedBy,
				memberRole: members.role,
			})
			.from(crews)
			.leftJoin(
				members,
				and(
					eq(members.organizationId, crews.organizationId),
					eq(members.userId, crews.userId),
				),
			)
			.where(and(...conditions))
			.orderBy(
				sortDirection === "asc" ? asc(orderColumn) : desc(orderColumn),
			)
			.limit(limit)
			.offset(offset);

		return {
			data: data.map((crew) => {
				const metadata = crew.metadata as Record<
					string,
					unknown
				> | null;
				const roleMeta = deriveCrewRoles({
					memberRole: crew.memberRole,
					workerType: crew.workerType,
					userId: crew.userId,
				});
				return {
					id: crew.id,
					organizationId: crew.organizationId,
					userId: crew.userId,
					name: crew.name,
					email: crew.email,
					phoneNumber: crew.phoneNumber,
					workerType: roleMeta.workerType,
					hasAppAccess: Boolean(crew.memberRole),
					memberRoles: roleMeta.memberRoles,
					displayRoles: roleMeta.displayRoles,
					isFreelancer: roleMeta.isFreelancer,
					specializations: extractSpecializations(metadata),
					status: crew.status,
					dailyRate: crew.dailyRate,
					metadata,
					createdBy: crew.createdBy,
					updatedBy: crew.updatedBy,
					createdAt: crew.createdAt.toISOString(),
					updatedAt: crew.updatedAt.toISOString(),
					deletedAt: crew.deletedAt?.toISOString() ?? null,
					deletedBy: crew.deletedBy,
				};
			}),
			pagination: createPaginationResponse(page, limit, total),
		};
	});
