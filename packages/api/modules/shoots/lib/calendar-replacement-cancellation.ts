import {
	and,
	calendarDeliveryIntents,
	eq,
	type shootCalendarEvents,
} from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";
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
	const method = params.mapping.deliveredDeliveryMethod;
	if (!method || method === "unsendable") {
		return;
	}
	const deliveredIntent = params.mapping.deliveredGeneration
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
	const sequence =
		method === "ics"
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
			deliveryMethod: method,
			recipientEmail: params.mapping.deliveredRecipientEmail,
			calendarId: params.mapping.deliveredCalendarId,
			googleEventId: params.mapping.deliveredGoogleEventId,
			googleConnectionId:
				deliveredSnapshot?.target.googleConnectionId ?? null,
			googleAccountEmail:
				deliveredSnapshot?.target.googleAccountEmail ?? null,
			googleCreateId: null,
			icalUid: params.mapping.deliveredIcalUid,
			icalSequence: sequence,
		},
	);
	await queueGeneration(tx, {
		...params,
		jobType: method === "ics" ? "ics_send_cancel" : "google_delete",
		kind: "cancellation",
		snapshot,
	});
}
