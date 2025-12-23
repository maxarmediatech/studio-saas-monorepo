import {
	and,
	count,
	eq,
	ilike,
	isNull,
	deliverables,
	db,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { createPaginationResponse } from "../../studio/schemas/common";
import {
	listDeliverablesMinimalInputSchema,
	listDeliverablesMinimalOutputSchema,
	type DeliverableMinimal,
} from "../../studio/schemas/deliverable";

export const listDeliverablesMinimal = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/deliverables/minimal",
		tags: ["Deliverables"],
		summary: "List deliverables (minimal)",
		description: "Lightweight list of deliverables for dropdowns and references",
	})
	.input(listDeliverablesMinimalInputSchema)
	.output(listDeliverablesMinimalOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "deliverable", "list");

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
				deliverableType: deliverables.deliverableType,
				status: deliverables.status,
				priority: deliverables.priority,
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
			deliverableType: row.deliverableType,
			status: row.status,
			priority: row.priority,
			workflowStatus: row.workflowStatus,
			dueDate: row.dueDate,
			bookingId: row.bookingId,
		}));

		return {
			data,
			pagination: createPaginationResponse(page, limit, total),
		};
	});
