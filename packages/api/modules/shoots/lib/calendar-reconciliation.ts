import {
	and,
	calendarRouteChanges,
	db,
	eq,
	isNull,
	shootAssignments,
	shootCalendarEvents,
	shoots,
	sql,
} from "@repo/database";
import { logger } from "@repo/logs";
import {
	enqueueCalendarCancellation,
	ensureAssignmentCalendarDelivery,
} from "./calendar-intents";

/**
 * Reconciliation intentionally considers every live assignment. Intent creation is
 * idempotent by its immutable snapshot, so this also repairs a missing mapping or
 * a missing job without relying on transient mapping status. Mapping-only rows are
 * candidates too: terminal, deleted, or unassigned targets need their snapshot
 * cancellation even when the crew can no longer be joined.
 */
export async function reconcileCalendarDeliveries(params: {
	organizationId: string;
	crewId?: string;
	apply: boolean;
}) {
	if (!params.organizationId) {
		throw new Error("Calendar reconciliation requires organizationId");
	}
	const pendingRouteChanges = await db.query.calendarRouteChanges.findMany({
		where: and(
			eq(calendarRouteChanges.organizationId, params.organizationId),
			params.crewId
				? eq(calendarRouteChanges.crewId, params.crewId)
				: undefined,
			eq(calendarRouteChanges.status, "pending"),
		),
	});
	const activeAssignments = await db
		.select({
			organizationId: shoots.organizationId,
			shootId: shootAssignments.shootId,
			crewId: shootAssignments.crewId,
		})
		.from(shootAssignments)
		.innerJoin(shoots, eq(shootAssignments.shootId, shoots.id))
		.where(
			and(
				isNull(shoots.deletedAt),
				sql`${shoots.status} NOT IN ('completed', 'cancelled')`,
				eq(shoots.organizationId, params.organizationId),
				params.crewId
					? eq(shootAssignments.crewId, params.crewId)
					: undefined,
			),
		);
	const staleMappings = await db
		.select({
			organizationId: shootCalendarEvents.organizationId,
			shootId: shootCalendarEvents.shootId,
			crewId: shootCalendarEvents.crewId,
		})
		.from(shootCalendarEvents)
		.leftJoin(
			shootAssignments,
			and(
				eq(shootCalendarEvents.shootId, shootAssignments.shootId),
				eq(shootCalendarEvents.crewId, shootAssignments.crewId),
			),
		)
		.leftJoin(shoots, eq(shootCalendarEvents.shootId, shoots.id))
		.where(
			and(
				eq(shootCalendarEvents.organizationId, params.organizationId),
				params.crewId
					? eq(shootCalendarEvents.crewId, params.crewId)
					: undefined,
				sql`(
					${shootAssignments.id} IS NULL
					OR ${shoots.deletedAt} IS NOT NULL
					OR ${shoots.status} IN ('completed', 'cancelled')
				)`,
				sql`NOT (
					${shootCalendarEvents.intentState} = 'cancelled'
					AND ${shootCalendarEvents.cancellationSyncStatus} IN ('synced', 'manual_reconciliation')
				)`,
			),
		);

	if (!params.apply) {
		return {
			candidates: activeAssignments.length + staleMappings.length,
			reconciled: 0,
			failed: 0,
		};
	}

	let reconciled = 0;
	let failed = 0;
	for (const candidate of activeAssignments) {
		try {
			const result = await db.transaction((tx) =>
				ensureAssignmentCalendarDelivery(tx, candidate),
			);
			if (result.state === "manual_reconciliation") {
				throw new Error(
					"Calendar delivery requires manual reconciliation",
				);
			}
			reconciled += 1;
		} catch (error) {
			failed += 1;
			logger.error("Calendar intent reconciliation failed", {
				...candidate,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
	for (const candidate of staleMappings) {
		try {
			await db.transaction((tx) =>
				enqueueCalendarCancellation(tx, candidate),
			);
			reconciled += 1;
		} catch (error) {
			failed += 1;
			logger.error("Calendar cancellation reconciliation failed", {
				...candidate,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
	if (failed === 0 && pendingRouteChanges.length > 0) {
		await db
			.update(calendarRouteChanges)
			.set({ status: "completed", completedAt: new Date() })
			.where(
				and(
					eq(
						calendarRouteChanges.organizationId,
						params.organizationId,
					),
					eq(calendarRouteChanges.status, "pending"),
					params.crewId
						? eq(calendarRouteChanges.crewId, params.crewId)
						: undefined,
				),
			);
	}
	return {
		candidates: activeAssignments.length + staleMappings.length,
		reconciled,
		failed,
	};
}
