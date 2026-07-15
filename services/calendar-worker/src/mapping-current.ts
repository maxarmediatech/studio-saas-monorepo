import {
	and,
	type calendarSyncJobs,
	db,
	eq,
	shootCalendarEvents,
} from "@repo/database";
import type { Snapshot } from "./provider-effects";

type Job = typeof calendarSyncJobs.$inferSelect;

async function getMapping(job: Job) {
	return db.query.shootCalendarEvents.findFirst({
		where: and(
			eq(shootCalendarEvents.organizationId, job.organizationId),
			eq(shootCalendarEvents.shootId, job.shootId ?? ""),
			eq(shootCalendarEvents.crewId, job.crewId ?? ""),
		),
	});
}

export async function deliveryIsCurrent(job: Job) {
	const mapping = await getMapping(job);
	return (
		mapping?.intentGeneration === job.generation &&
		mapping.intentState === "active" &&
		!["pending", "error", "manual_reconciliation"].includes(
			mapping.cancellationSyncStatus,
		)
	);
}

export async function deliveryWaitsForCancellation(job: Job) {
	const mapping = await getMapping(job);
	return Boolean(
		mapping?.intentGeneration === job.generation &&
			mapping.intentState === "active" &&
			["pending", "error", "manual_reconciliation"].includes(
				mapping.cancellationSyncStatus,
			),
	);
}

export async function cancellationIsCurrent(job: Job, _snapshot: Snapshot) {
	const mapping = await getMapping(job);
	return Boolean(
		mapping &&
			!["synced", "manual_reconciliation"].includes(
				mapping.cancellationSyncStatus,
			),
	);
}
