import {
	and,
	calendarDeliveryIntents,
	calendarSyncJobs,
	eq,
	inArray,
	ne,
	type shootCalendarEvents,
} from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";
import { resolveCancellationEvidence } from "./calendar-cancellation-evidence";
import { markCancellationForManualReconciliation } from "./calendar-cancellation-state";
import {
	getNextIcalSequence,
	queueGeneration,
} from "./calendar-intent-persistence";
import { buildSnapshot, type IntentTarget } from "./calendar-intent-snapshot";
import type { CalendarSnapshot } from "./calendar-intents";

export async function queueReplacementCancellation(
	tx: TransactionClient,
	params: {
		organizationId: string;
		shootId: string;
		crewId: string;
		generation: number;
		intentId: string;
		mapping: typeof shootCalendarEvents.$inferSelect;
		target: IntentTarget;
	},
) {
	if (params.mapping.cancellationSyncStatus === "manual_reconciliation") {
		return {
			state: "manual_reconciliation" as const,
			reason: params.mapping.cancellationLastError,
		};
	}
	const unresolved = await tx.query.calendarSyncJobs.findFirst({
		where: and(
			eq(calendarSyncJobs.organizationId, params.organizationId),
			eq(calendarSyncJobs.shootId, params.shootId),
			eq(calendarSyncJobs.crewId, params.crewId),
			inArray(calendarSyncJobs.jobType, [
				"google_delete",
				"ics_send_cancel",
			]),
			ne(calendarSyncJobs.status, "completed"),
		),
	});
	if (unresolved) {
		if (
			unresolved.status === "failed" &&
			(unresolved.attempts ?? 0) >= (unresolved.maxAttempts ?? 5)
		) {
			const reason =
				unresolved.lastError ??
				"Calendar cancellation retry limit exhausted";
			await tx
				.update(calendarSyncJobs)
				.set({ effectState: "manual_reconciliation" })
				.where(eq(calendarSyncJobs.id, unresolved.id));
			await markCancellationForManualReconciliation(
				tx,
				params.mapping.id,
				reason,
				false,
			);
			return { state: "manual_reconciliation" as const, reason };
		}
		return { state: "pending" as const };
	}
	const method = params.mapping.deliveredDeliveryMethod;
	if (!method || method === "unsendable") {
		return { state: "none" as const };
	}
	const deliveredIntent =
		params.mapping.deliveredGeneration != null
			? await tx.query.calendarDeliveryIntents.findFirst({
					where: and(
						eq(
							calendarDeliveryIntents.organizationId,
							params.organizationId,
						),
						eq(calendarDeliveryIntents.shootId, params.shootId),
						eq(calendarDeliveryIntents.crewId, params.crewId),
						eq(
							calendarDeliveryIntents.generation,
							params.mapping.deliveredGeneration,
						),
					),
				})
			: null;
	const deliveredSnapshot = deliveredIntent?.payload as
		| CalendarSnapshot
		| undefined;
	const evidence = resolveCancellationEvidence({
		mapping: params.mapping,
		deliveredSnapshot,
	});
	if (evidence.kind === "no_effect") {
		return { state: "none" as const };
	}
	if (evidence.kind === "manual_reconciliation") {
		await markCancellationForManualReconciliation(
			tx,
			params.mapping.id,
			evidence.reason,
			false,
		);
		return {
			state: "manual_reconciliation" as const,
			reason: evidence.reason,
		};
	}
	const sequence =
		evidence.deliveryMethod === "ics"
			? await getNextIcalSequence(
					tx,
					params,
					params.mapping.deliveredIcalSequence ?? 0,
				)
			: 0;
	const snapshot = buildSnapshot(
		params.target,
		{ operation: "cancellation", intentState: "active" },
		{
			...evidence.target,
			icalSequence: sequence,
		},
	);
	await queueGeneration(tx, {
		...params,
		jobType:
			evidence.deliveryMethod === "ics"
				? "ics_send_cancel"
				: "google_delete",
		kind: "cancellation",
		snapshot,
	});
	return { state: "queued" as const };
}
