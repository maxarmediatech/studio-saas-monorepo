import type { shootCalendarEvents } from "@repo/database";
import type { CalendarSnapshot } from "./calendar-intents";

type Mapping = typeof shootCalendarEvents.$inferSelect;

export type DeliveredCalendarIdentityResolution =
	| {
			kind: "no_effect";
			reason: string;
	  }
	| {
			kind: "manual_reconciliation";
			reason: string;
	  }
	| {
			kind: "actionable";
			deliveryMethod: "google" | "ics";
			target: CalendarSnapshot["target"];
			deliveredSnapshot: CalendarSnapshot | null;
			source: "durable" | "legacy";
	  };

export type LegacyGoogleConnection = {
	id: string;
	googleAccountEmail: string | null;
};

export function resolveDeliveredCalendarIdentity(input: {
	mapping: Mapping;
	deliveredSnapshot?: CalendarSnapshot | null;
	legacyGoogleConnection?: LegacyGoogleConnection | null;
	legacyGoogleIdentityAmbiguous?: boolean;
}): DeliveredCalendarIdentityResolution {
	const { mapping, deliveredSnapshot } = input;
	if (
		mapping.deliverySyncStatus === "manual_reconciliation" ||
		mapping.cancellationSyncStatus === "manual_reconciliation"
	) {
		return {
			kind: "manual_reconciliation",
			reason:
				mapping.deliveryLastError ??
				mapping.cancellationLastError ??
				"Calendar provider outcome requires manual reconciliation",
		};
	}
	const hasEffectEvidence = Boolean(
		mapping.deliveredGeneration != null ||
			mapping.syncStatus === "synced" ||
			mapping.deliverySyncStatus === "synced" ||
			mapping.deliveredGoogleEventId ||
			mapping.googleEventId ||
			mapping.deliveredIcalUid ||
			deliveredSnapshot?.target.googleEventId ||
			deliveredSnapshot?.target.icalUid ||
			(mapping.icalUid && mapping.deliverySyncStatus === "synced"),
	);
	if (!hasEffectEvidence) {
		return {
			kind: "no_effect",
			reason: "No evidence that an external calendar effect was delivered",
		};
	}

	const method =
		mapping.deliveredDeliveryMethod ??
		deliveredSnapshot?.target.deliveryMethod ??
		mapping.deliveryMethod;
	const baseTarget: CalendarSnapshot["target"] = {
		deliveryMethod: method,
		recipientEmail:
			mapping.deliveredRecipientEmail ??
			deliveredSnapshot?.target.recipientEmail ??
			mapping.recipientEmail,
		googleUserId: deliveredSnapshot?.target.googleUserId ?? null,
		googleConnectionId:
			deliveredSnapshot?.target.googleConnectionId ??
			input.legacyGoogleConnection?.id ??
			null,
		googleAccountEmail:
			deliveredSnapshot?.target.googleAccountEmail ??
			input.legacyGoogleConnection?.googleAccountEmail ??
			null,
		googleCreateId: null,
		calendarId:
			mapping.deliveredCalendarId ??
			deliveredSnapshot?.target.calendarId ??
			mapping.calendarId,
		googleEventId:
			mapping.deliveredGoogleEventId ??
			deliveredSnapshot?.target.googleEventId ??
			mapping.googleEventId,
		icalUid:
			mapping.deliveredIcalUid ??
			deliveredSnapshot?.target.icalUid ??
			mapping.icalUid,
		icalSequence:
			mapping.deliveredIcalSequence ??
			deliveredSnapshot?.target.icalSequence ??
			mapping.icalSequence,
	};

	if (method === "google") {
		const missing = [
			input.legacyGoogleIdentityAmbiguous ||
			!baseTarget.googleConnectionId
				? "connection/account"
				: null,
			!baseTarget.calendarId ? "calendar" : null,
			!baseTarget.googleEventId ? "event" : null,
		].filter(Boolean);
		if (missing.length > 0) {
			return {
				kind: "manual_reconciliation",
				reason: `Delivered Google effect lacks provable immutable ${missing.join(", ")} identity`,
			};
		}
		return {
			kind: "actionable",
			deliveryMethod: "google",
			target: baseTarget,
			deliveredSnapshot: deliveredSnapshot ?? null,
			source: deliveredSnapshot ? "durable" : "legacy",
		};
	}

	if (method === "ics") {
		const missing = [
			!baseTarget.recipientEmail?.trim() ? "recipient" : null,
			!baseTarget.icalUid ? "UID" : null,
			baseTarget.icalSequence == null ? "sequence" : null,
		].filter(Boolean);
		if (missing.length > 0) {
			return {
				kind: "manual_reconciliation",
				reason: `Delivered ICS effect lacks immutable ${missing.join(", ")} identity`,
			};
		}
		return {
			kind: "actionable",
			deliveryMethod: "ics",
			target: baseTarget,
			deliveredSnapshot: deliveredSnapshot ?? null,
			source: deliveredSnapshot ? "durable" : "legacy",
		};
	}

	return {
		kind: "manual_reconciliation",
		reason: "External calendar effect has no cancellable delivery method",
	};
}
