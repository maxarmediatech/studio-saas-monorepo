import { and, db, eq, ilike, isNull, paymentSchedules } from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
import { requireAnyPermission } from "../../../studio/lib/permissions";
import { createPaginationResponse } from "../../../studio/schemas/common";
import {
	listSchedulesMinimalInputSchema,
	listSchedulesMinimalOutputSchema,
	type PaymentScheduleMinimal,
} from "../../../studio/schemas/payment";

export const listSchedulesMinimal = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/studio-payments/schedules/minimal",
		tags: ["Studio Payments"],
		summary: "List payment schedules (minimal)",
		description:
			"Lightweight list of payment schedules for dropdowns and references",
	})
	.input(listSchedulesMinimalInputSchema)
	.output(listSchedulesMinimalOutputSchema)
	.handler(async ({ input, context }) => {
		await requireAnyPermission(context, [
			{ resource: "payment", action: "list" },
			{ resource: "payment", action: "reference" },
		]);

		const { page, limit, search, bookingId } = input;
		const offset = (page - 1) * limit;

		const conditions = [
			eq(paymentSchedules.organizationId, context.organizationId),
			isNull(paymentSchedules.deletedAt),
		];

		if (bookingId) {
			conditions.push(eq(paymentSchedules.bookingId, bookingId));
		}

		if (search) {
			conditions.push(ilike(paymentSchedules.name, `%${search}%`));
		}

		const rows = await db
			.select({
				id: paymentSchedules.id,
				name: paymentSchedules.name,
				dueDate: paymentSchedules.dueDate,
				status: paymentSchedules.status,
				bookingId: paymentSchedules.bookingId,
			})
			.from(paymentSchedules)
			.where(and(...conditions))
			.orderBy(paymentSchedules.name)
			.limit(limit)
			.offset(offset);

		const data: PaymentScheduleMinimal[] = rows.map((row) => ({
			id: row.id,
			name: row.name,
			dueDate: row.dueDate,
			status: row.status,
			bookingId: row.bookingId,
		}));

		const totalResult = await db
			.select({ count: db.$count(paymentSchedules) })
			.from(paymentSchedules)
			.where(and(...conditions));

		const total = totalResult[0]?.count ?? 0;

		return {
			data,
			pagination: createPaginationResponse(page, limit, total),
		};
	});
