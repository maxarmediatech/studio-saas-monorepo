import { TZDate } from "@date-fns/tz";
import {
	and,
	db,
	deliverables,
	eq,
	isNull,
	lt,
	or,
	organizations,
	sql,
	tasks,
} from "@repo/database";
import { logger } from "@repo/logs";
import { addDays, format, startOfDay } from "date-fns";
import { safeNotifyEntityUsers } from "../../../packages/api/modules/notifications/lib/notification-service";

function hasFlag(name: string): boolean {
	return process.argv.includes(name);
}

function getDateMarkers(timezone: string) {
	const todayInTz = startOfDay(new TZDate(new Date(), timezone));
	const tomorrowInTz = addDays(todayInTz, 1);

	return {
		today: format(todayInTz, "yyyy-MM-dd"),
		tomorrow: format(tomorrowInTz, "yyyy-MM-dd"),
	};
}

async function processTasksForOrganization(params: {
	organizationId: string;
	timezone: string;
	apply: boolean;
}) {
	const { organizationId, timezone, apply } = params;
	const { today, tomorrow } = getDateMarkers(timezone);

	const dueSoonTasks = await db
		.select({
			id: tasks.id,
			name: tasks.name,
			dueDate: tasks.dueDate,
		})
		.from(tasks)
		.where(
			and(
				eq(tasks.organizationId, organizationId),
				isNull(tasks.deletedAt),
				eq(tasks.dueDate, tomorrow),
				sql`${tasks.workflowStatus} != 'approved'`,
			),
		);

	const overdueTasks = await db
		.select({
			id: tasks.id,
			name: tasks.name,
			dueDate: tasks.dueDate,
		})
		.from(tasks)
		.where(
			and(
				eq(tasks.organizationId, organizationId),
				isNull(tasks.deletedAt),
				lt(tasks.dueDate, today),
				sql`${tasks.workflowStatus} != 'approved'`,
			),
		);

	for (const task of dueSoonTasks) {
		if (!task.dueDate) {
			continue;
		}

		logger.info("Due soon task reminder candidate", {
			organizationId,
			taskId: task.id,
			name: task.name,
			dueDate: task.dueDate,
		});

		if (!apply) {
			continue;
		}

		await safeNotifyEntityUsers({
			organizationId,
			entityType: "task",
			entityId: task.id,
			entityName: task.name,
			type: "due_soon",
			title: `Task due soon: ${task.name}`,
			body: `Due on ${task.dueDate}`,
			metadata: {
				kind: "due_soon",
				dueDate: task.dueDate,
				daysUntilDue: 1,
			},
		});
	}

	for (const task of overdueTasks) {
		if (!task.dueDate) {
			continue;
		}

		logger.info("Overdue task reminder candidate", {
			organizationId,
			taskId: task.id,
			name: task.name,
			dueDate: task.dueDate,
		});

		if (!apply) {
			continue;
		}

		await safeNotifyEntityUsers({
			organizationId,
			entityType: "task",
			entityId: task.id,
			entityName: task.name,
			type: "overdue",
			title: `Task overdue: ${task.name}`,
			body: `Was due on ${task.dueDate}`,
			metadata: {
				kind: "overdue",
				dueDate: task.dueDate,
				daysUntilDue: null,
			},
		});
	}

	return {
		dueSoonCount: dueSoonTasks.length,
		overdueCount: overdueTasks.length,
	};
}

async function processDeliverablesForOrganization(params: {
	organizationId: string;
	timezone: string;
	apply: boolean;
}) {
	const { organizationId, timezone, apply } = params;
	const { today, tomorrow } = getDateMarkers(timezone);

	const dueSoonDeliverables = await db
		.select({
			id: deliverables.id,
			name: deliverables.name,
			dueDate: deliverables.dueDate,
		})
		.from(deliverables)
		.where(
			and(
				eq(deliverables.organizationId, organizationId),
				isNull(deliverables.deletedAt),
				eq(deliverables.dueDate, tomorrow),
				sql`${deliverables.workflowStatus} != 'approved'`,
			),
		);

	const overdueDeliverables = await db
		.select({
			id: deliverables.id,
			name: deliverables.name,
			dueDate: deliverables.dueDate,
		})
		.from(deliverables)
		.where(
			and(
				eq(deliverables.organizationId, organizationId),
				isNull(deliverables.deletedAt),
				lt(deliverables.dueDate, today),
				sql`${deliverables.workflowStatus} != 'approved'`,
			),
		);

	for (const deliverable of dueSoonDeliverables) {
		if (!deliverable.dueDate) {
			continue;
		}

		logger.info("Due soon deliverable reminder candidate", {
			organizationId,
			deliverableId: deliverable.id,
			name: deliverable.name,
			dueDate: deliverable.dueDate,
		});

		if (!apply) {
			continue;
		}

		await safeNotifyEntityUsers({
			organizationId,
			entityType: "deliverable",
			entityId: deliverable.id,
			entityName: deliverable.name,
			type: "due_soon",
			title: `Deliverable due soon: ${deliverable.name}`,
			body: `Due on ${deliverable.dueDate}`,
			metadata: {
				kind: "due_soon",
				dueDate: deliverable.dueDate,
				daysUntilDue: 1,
			},
		});
	}

	for (const deliverable of overdueDeliverables) {
		if (!deliverable.dueDate) {
			continue;
		}

		logger.info("Overdue deliverable reminder candidate", {
			organizationId,
			deliverableId: deliverable.id,
			name: deliverable.name,
			dueDate: deliverable.dueDate,
		});

		if (!apply) {
			continue;
		}

		await safeNotifyEntityUsers({
			organizationId,
			entityType: "deliverable",
			entityId: deliverable.id,
			entityName: deliverable.name,
			type: "overdue",
			title: `Deliverable overdue: ${deliverable.name}`,
			body: `Was due on ${deliverable.dueDate}`,
			metadata: {
				kind: "overdue",
				dueDate: deliverable.dueDate,
				daysUntilDue: null,
			},
		});
	}

	return {
		dueSoonCount: dueSoonDeliverables.length,
		overdueCount: overdueDeliverables.length,
	};
}

async function main() {
	const apply = hasFlag("--apply");

	logger.info(
		apply
			? "Sending deadline reminders"
			: "Dry run for deadline reminders (use --apply to send)",
	);

	const orgs = await db
		.select({
			id: organizations.id,
			name: organizations.name,
			timezone: organizations.timezone,
		})
		.from(organizations)
		.where(
			or(
				sql`${organizations.slug} IS NOT NULL`,
				sql`${organizations.id} IS NOT NULL`,
			),
		);

	let totalDueSoon = 0;
	let totalOverdue = 0;

	for (const org of orgs) {
		const taskResult = await processTasksForOrganization({
			organizationId: org.id,
			timezone: org.timezone,
			apply,
		});
		const deliverableResult = await processDeliverablesForOrganization({
			organizationId: org.id,
			timezone: org.timezone,
			apply,
		});

		totalDueSoon +=
			taskResult.dueSoonCount + deliverableResult.dueSoonCount;
		totalOverdue +=
			taskResult.overdueCount + deliverableResult.overdueCount;

		logger.info("Processed deadline reminders for organization", {
			organizationId: org.id,
			name: org.name,
			timezone: org.timezone,
			dueSoon: taskResult.dueSoonCount + deliverableResult.dueSoonCount,
			overdue: taskResult.overdueCount + deliverableResult.overdueCount,
		});
	}

	logger.success("Deadline reminder run complete", {
		apply,
		totalDueSoon,
		totalOverdue,
	});
}

main().catch((error) => {
	logger.error("Deadline reminder run failed", { error });
	process.exit(1);
});
