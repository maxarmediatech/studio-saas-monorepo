import { and, calendarSyncJobs, eq, shootCalendarEvents } from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";
import {
	getCalendarDeliveryKey,
	queueGeneration,
} from "./calendar-intent-persistence";
import type {
	CalendarJobType,
	CalendarSnapshot,
	DeliveryMethod,
} from "./calendar-intents";

export async function ensureActiveDeliveryJob(
	tx: TransactionClient,
	params: {
		organizationId: string;
		shootId: string;
		crewId: string;
		mappingId: string;
		deliveryMethod: DeliveryMethod;
		intent: { id: string; generation: number };
		snapshot: CalendarSnapshot;
	},
) {
	const deliveryKey = getCalendarDeliveryKey({
		...params,
		generation: params.intent.generation,
		kind: "delivery",
	});
	const currentJob = await tx.query.calendarSyncJobs.findFirst({
		where: and(
			eq(calendarSyncJobs.organizationId, params.organizationId),
			eq(calendarSyncJobs.deliveryKey, deliveryKey),
		),
	});
	const jobType: CalendarJobType =
		params.deliveryMethod === "google"
			? params.snapshot.target.googleEventId
				? "google_update"
				: "google_create"
			: params.snapshot.target.icalSequence
				? "ics_send_update"
				: "ics_send_invite";
	if (!currentJob) {
		await queueGeneration(tx, {
			...params,
			intentId: params.intent.id,
			generation: params.intent.generation,
			jobType,
			kind: "delivery",
			snapshot: params.snapshot,
		});
		return "queued" as const;
	}
	if (
		currentJob.status === "failed" &&
		(currentJob.attempts ?? 0) >= (currentJob.maxAttempts ?? 5)
	) {
		await tx
			.update(shootCalendarEvents)
			.set({
				syncStatus: "error",
				lastError:
					currentJob.lastError ??
					"Calendar delivery retry limit exhausted",
				updatedAt: new Date(),
			})
			.where(eq(shootCalendarEvents.id, params.mappingId));
		return "error" as const;
	}
	return "queued" as const;
}

export async function repairCancellationJob(
	tx: TransactionClient,
	params: {
		organizationId: string;
		shootId: string;
		crewId: string;
		mappingId: string;
		intent: { id: string; generation: number; payload: unknown };
		deliveryMethod: DeliveryMethod;
	},
) {
	const deliveryKey = getCalendarDeliveryKey({
		...params,
		generation: params.intent.generation,
		kind: "cancellation",
	});
	const job = await tx.query.calendarSyncJobs.findFirst({
		where: and(
			eq(calendarSyncJobs.organizationId, params.organizationId),
			eq(calendarSyncJobs.deliveryKey, deliveryKey),
		),
	});
	const jobType: CalendarJobType =
		params.deliveryMethod === "ics" ? "ics_send_cancel" : "google_delete";
	if (!job) {
		await queueGeneration(tx, {
			...params,
			intentId: params.intent.id,
			generation: params.intent.generation,
			jobType,
			kind: "cancellation",
			snapshot: params.intent.payload as CalendarSnapshot,
		});
	} else if (
		job.status === "failed" &&
		(job.attempts ?? 0) >= (job.maxAttempts ?? 5)
	) {
		await tx
			.update(shootCalendarEvents)
			.set({
				syncStatus: "error",
				cancellationSyncStatus: "error",
				cancellationLastError:
					job.lastError ??
					"Calendar cancellation retry limit exhausted",
				lastError:
					job.lastError ??
					"Calendar cancellation retry limit exhausted",
			})
			.where(eq(shootCalendarEvents.id, params.mappingId));
	}
	return jobType;
}
