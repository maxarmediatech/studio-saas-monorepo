import {
	and,
	calendarDeliveryIntents,
	eq,
	googleCalendarConnections,
	type shootCalendarEvents,
} from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";
import {
	type DeliveredCalendarIdentityResolution,
	type LegacyGoogleConnection,
	resolveDeliveredCalendarIdentity,
} from "./calendar-cancellation-evidence";
import type { CalendarSnapshot } from "./calendar-intents";

type Mapping = typeof shootCalendarEvents.$inferSelect;

export async function readDeliveredCalendarIdentity(
	tx: TransactionClient,
	input: {
		mapping: Mapping;
		crewUserId: string | null;
		deliveredSnapshot?: CalendarSnapshot | null;
	},
): Promise<DeliveredCalendarIdentityResolution> {
	let deliveredSnapshot = input.deliveredSnapshot ?? null;
	if (!deliveredSnapshot && input.mapping.deliveredGeneration != null) {
		const intent = await tx.query.calendarDeliveryIntents.findFirst({
			where: and(
				eq(
					calendarDeliveryIntents.organizationId,
					input.mapping.organizationId,
				),
				eq(calendarDeliveryIntents.shootId, input.mapping.shootId),
				eq(calendarDeliveryIntents.crewId, input.mapping.crewId),
				eq(
					calendarDeliveryIntents.generation,
					input.mapping.deliveredGeneration,
				),
			),
		});
		const payload = intent?.payload as CalendarSnapshot | undefined;
		if (intent && payload?.target) {
			deliveredSnapshot = {
				...payload,
				target: {
					...payload.target,
					googleConnectionId:
						payload.target.googleConnectionId ??
						intent.googleConnectionId,
					googleAccountEmail:
						payload.target.googleAccountEmail ??
						intent.googleAccountEmail,
					calendarId: payload.target.calendarId ?? intent.calendarId,
					googleEventId:
						payload.target.googleEventId ?? intent.googleEventId,
					icalUid: payload.target.icalUid ?? intent.icalUid,
					icalSequence:
						payload.target.icalSequence ?? intent.icalSequence,
				},
			};
		}
	}

	const method =
		input.mapping.deliveredDeliveryMethod ??
		deliveredSnapshot?.target.deliveryMethod ??
		input.mapping.deliveryMethod;
	let legacyGoogleConnections: LegacyGoogleConnection[] = [];
	if (
		method === "google" &&
		!deliveredSnapshot?.target.googleConnectionId &&
		input.crewUserId
	) {
		legacyGoogleConnections = await tx
			.select({
				id: googleCalendarConnections.id,
				googleAccountEmail:
					googleCalendarConnections.googleAccountEmail,
			})
			.from(googleCalendarConnections)
			.where(
				and(
					eq(
						googleCalendarConnections.organizationId,
						input.mapping.organizationId,
					),
					eq(googleCalendarConnections.userId, input.crewUserId),
				),
			)
			.limit(2);
	}

	return resolveDeliveredCalendarIdentity({
		mapping: input.mapping,
		deliveredSnapshot,
		legacyGoogleConnection:
			legacyGoogleConnections.length === 1
				? legacyGoogleConnections[0]
				: null,
		legacyGoogleIdentityAmbiguous:
			method === "google" &&
			!deliveredSnapshot?.target.googleConnectionId &&
			legacyGoogleConnections.length !== 1,
	});
}
