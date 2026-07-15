import {
	and,
	calendarSyncJobs,
	eq,
	inArray,
	ne,
	type shootCalendarEvents,
} from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";
import type { DeliveredCalendarIdentityResolution } from "./calendar-cancellation-evidence";
import { markCancellationForManualReconciliation } from "./calendar-cancellation-state";
import {
	getNextIcalSequence,
	queueGeneration,
} from "./calendar-intent-persistence";
import { buildSnapshot, type IntentTarget } from "./calendar-intent-snapshot";

type ActionableIdentity = Extract<
	DeliveredCalendarIdentityResolution,
	{ kind: "actionable" }
>;

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
		deliveredIdentity: ActionableIdentity;
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
		if (unresolved.effectState === "provider_applied") {
			// The external cancellation result is already known. Keep the
			// replacement fenced while stale recovery reclaims this job and
			// completes only its database transition.
			return { state: "pending" as const };
		}
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
	const evidence = params.deliveredIdentity;
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
