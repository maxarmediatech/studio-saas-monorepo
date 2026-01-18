import {
	and,
	count,
	db,
	deliverables,
	eq,
	ilike,
	isNull,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { createPaginationResponse } from "../../studio/schemas/common";
import {
	type DeliverableMinimal,
	listDeliverablesMinimalInputSchema,
	listDeliverablesMinimalOutputSchema,
} from "../../studio/schemas/deliverable";

export const listDeliverablesMinimal = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/deliverables/minimal",
		tags: ["Deliverables"],
		summary: "List deliverables (minimal)",
		description:
			"Lightweight list of deliverables for dropdowns and references",
	})
	.input(listDeliverablesMinimalInputSchema)
	.output(listDeliverablesMinimalOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "deliverable", "list");

		const { page, limit, search, bookingId, workflowStatus } = input;
		const offset = (page - 1) * limit;

		// Build conditions
		const conditions = [
			eq(deliverables.organizationId, context.organizationId),
			isNull(deliverables.deletedAt),
		];

		if (bookingId) {
			conditions.push(eq(deliverables.bookingId, bookingId));
		}

		if (workflowStatus) {
			conditions.push(eq(deliverables.workflowStatus, workflowStatus));
		}

		if (search) {
			conditions.push(ilike(deliverables.name, `%${search}%`));
		}

		// Get total count
		const [countResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(deliverables)
			.where(and(...conditions));

		const total = countResult?.count ?? 0;

		// Get deliverables
		const rows = await db
			.select({
				id: deliverables.id,
				name: deliverables.name,
				status: deliverables.status,
				workflowStatus: deliverables.workflowStatus,
				dueDate: deliverables.dueDate,
				bookingId: deliverables.bookingId,
			})
			.from(deliverables)
			.where(and(...conditions))
			.orderBy(deliverables.name)
			.limit(limit)
			.offset(offset);

		const data: DeliverableMinimal[] = rows.map((row) => ({
			id: row.id,
			name: row.name,
			status: row.status,
			workflowStatus: row.workflowStatus,
			dueDate: row.dueDate,
			bookingId: row.bookingId,
		}));

		return {
			data,
			pagination: createPaginationResponse(page, limit, total),
		};
	});
