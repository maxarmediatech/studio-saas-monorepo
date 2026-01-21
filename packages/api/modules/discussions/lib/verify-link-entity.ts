import {
	and,
	bookings,
	db,
	deliverables,
	eq,
	expenses,
	isNull,
	paymentSchedules,
	shoots,
	tasks,
} from "@repo/database";
import type { DiscussionLinkEntityType } from "../schemas";

export async function verifyLinkEntityExists(
	entityType: DiscussionLinkEntityType,
	entityId: string,
	organizationId: string,
): Promise<boolean> {
	switch (entityType) {
		case "booking": {
			const result = await db
				.select({ id: bookings.id })
				.from(bookings)
				.where(
					and(
						eq(bookings.id, entityId),
						eq(bookings.organizationId, organizationId),
						isNull(bookings.deletedAt),
					),
				)
				.limit(1);
			return result.length > 0;
		}
		case "shoot": {
			const result = await db
				.select({ id: shoots.id })
				.from(shoots)
				.where(
					and(
						eq(shoots.id, entityId),
						eq(shoots.organizationId, organizationId),
						isNull(shoots.deletedAt),
					),
				)
				.limit(1);
			return result.length > 0;
		}
		case "task": {
			const result = await db
				.select({ id: tasks.id })
				.from(tasks)
				.where(
					and(
						eq(tasks.id, entityId),
						eq(tasks.organizationId, organizationId),
						isNull(tasks.deletedAt),
					),
				)
				.limit(1);
			return result.length > 0;
		}
		case "deliverable": {
			const result = await db
				.select({ id: deliverables.id })
				.from(deliverables)
				.where(
					and(
						eq(deliverables.id, entityId),
						eq(deliverables.organizationId, organizationId),
						isNull(deliverables.deletedAt),
					),
				)
				.limit(1);
			return result.length > 0;
		}
		case "payment_schedule": {
			const result = await db
				.select({ id: paymentSchedules.id })
				.from(paymentSchedules)
				.where(
					and(
						eq(paymentSchedules.id, entityId),
						isNull(paymentSchedules.deletedAt),
					),
				)
				.limit(1);
			return result.length > 0;
		}
		case "expense": {
			const result = await db
				.select({ id: expenses.id })
				.from(expenses)
				.where(
					and(
						eq(expenses.id, entityId),
						eq(expenses.organizationId, organizationId),
						isNull(expenses.deletedAt),
					),
				)
				.limit(1);
			return result.length > 0;
		}
		default:
			return false;
	}
}
