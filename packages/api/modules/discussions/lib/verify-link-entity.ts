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
import { hasPermission } from "../../studio/lib/permissions";
import type { DiscussionLinkEntityType } from "../schemas";

interface LinkEntityAccessContext {
	headers: Headers;
	organizationId: string;
}

async function hasLinkEntityPermission(
	context: LinkEntityAccessContext,
	entityType: DiscussionLinkEntityType,
): Promise<boolean> {
	switch (entityType) {
		case "booking":
			return (
				(await hasPermission(context, "booking", "read")) ||
				(await hasPermission(context, "booking", "list"))
			);
		case "shoot":
			return (
				(await hasPermission(context, "shoot", "read")) ||
				(await hasPermission(context, "shoot", "list"))
			);
		case "task":
			return (
				(await hasPermission(context, "task", "read")) ||
				(await hasPermission(context, "task", "list"))
			);
		case "deliverable":
			return (
				(await hasPermission(context, "deliverable", "read")) ||
				(await hasPermission(context, "deliverable", "list"))
			);
		case "payment_schedule":
			return (
				(await hasPermission(context, "payment", "read")) ||
				(await hasPermission(context, "payment", "list")) ||
				(await hasPermission(context, "payment", "reference"))
			);
		case "expense":
			return (
				(await hasPermission(context, "expense", "read")) ||
				(await hasPermission(context, "expense", "list")) ||
				(await hasPermission(context, "expense", "reference"))
			);
		default:
			return false;
	}
}

export async function verifyLinkEntityExists(
	entityType: DiscussionLinkEntityType,
	entityId: string,
	context: LinkEntityAccessContext,
): Promise<boolean> {
	const hasEntityPermission = await hasLinkEntityPermission(
		context,
		entityType,
	);

	if (!hasEntityPermission) {
		return false;
	}

	switch (entityType) {
		case "booking": {
			const result = await db
				.select({ id: bookings.id })
				.from(bookings)
				.where(
					and(
						eq(bookings.id, entityId),
						eq(bookings.organizationId, context.organizationId),
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
						eq(shoots.organizationId, context.organizationId),
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
						eq(tasks.organizationId, context.organizationId),
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
						eq(deliverables.organizationId, context.organizationId),
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
						eq(
							paymentSchedules.organizationId,
							context.organizationId,
						),
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
						eq(expenses.organizationId, context.organizationId),
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
