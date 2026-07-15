import { describe, expect, it } from "vitest";
import { resolveDeliveredCalendarIdentity } from "./calendar-cancellation-evidence";

function mapping(overrides: Record<string, unknown> = {}) {
	return {
		deliveryMethod: "ics",
		deliverySyncStatus: "pending",
		syncStatus: "pending",
		icalSequence: 0,
		...overrides,
	} as never;
}

describe("delivered calendar identity", () => {
	it("completes rows with no evidence of an external effect as a no-op", () => {
		expect(
			resolveDeliveredCalendarIdentity({ mapping: mapping() }),
		).toMatchObject({
			kind: "no_effect",
		});
	});

	it("accepts complete immutable Google identity", () => {
		expect(
			resolveDeliveredCalendarIdentity({
				mapping: mapping({
					deliveredGeneration: 1,
					deliveredDeliveryMethod: "google",
					deliveredCalendarId: "primary",
					deliveredGoogleEventId: "event-1",
				}),
				deliveredSnapshot: {
					target: { googleConnectionId: "connection-1" },
				} as never,
			}),
		).toMatchObject({ kind: "actionable", deliveryMethod: "google" });
	});

	it("accepts complete immutable ICS identity", () => {
		expect(
			resolveDeliveredCalendarIdentity({
				mapping: mapping({
					deliveredGeneration: 1,
					deliveredDeliveryMethod: "ics",
					deliveredRecipientEmail: "crew@example.com",
					deliveredIcalUid: "uid-1",
					deliveredIcalSequence: 4,
				}),
			}),
		).toMatchObject({
			kind: "actionable",
			deliveryMethod: "ics",
			target: { icalSequence: 4 },
		});
	});

	it("treats a successfully cancelled identity as retired", () => {
		expect(
			resolveDeliveredCalendarIdentity({
				mapping: mapping({
					cancellationSyncStatus: "synced",
					deliveredGeneration: 1,
					deliveredDeliveryMethod: "ics",
					deliveredRecipientEmail: "crew@example.com",
					deliveredIcalUid: "cancelled-uid",
					deliveredIcalSequence: 4,
				}),
			}),
		).toMatchObject({
			kind: "no_effect",
			reason: expect.stringContaining("was cancelled"),
		});
	});

	it("accepts effect evidence retained only by an immutable snapshot", () => {
		expect(
			resolveDeliveredCalendarIdentity({
				mapping: mapping(),
				deliveredSnapshot: {
					target: {
						deliveryMethod: "ics",
						recipientEmail: "crew@example.com",
						icalUid: "snapshot-only-uid",
						icalSequence: 2,
					},
				} as never,
			}),
		).toMatchObject({ kind: "actionable", deliveryMethod: "ics" });
	});

	it("quarantines delivered effects with incomplete identity", () => {
		expect(
			resolveDeliveredCalendarIdentity({
				mapping: mapping({
					deliveredGeneration: 1,
					deliveredDeliveryMethod: "google",
					deliveredGoogleEventId: "event-1",
				}),
			}),
		).toMatchObject({ kind: "manual_reconciliation" });
	});

	it("recognises a safe legacy ICS identity without delivered columns", () => {
		expect(
			resolveDeliveredCalendarIdentity({
				mapping: mapping({
					syncStatus: "synced",
					deliverySyncStatus: "synced",
					recipientEmail: "legacy@example.com",
					icalUid: "legacy-uid",
					icalSequence: 7,
				}),
			}),
		).toMatchObject({
			kind: "actionable",
			deliveryMethod: "ics",
			source: "legacy",
			target: {
				recipientEmail: "legacy@example.com",
				icalUid: "legacy-uid",
				icalSequence: 7,
			},
		});
	});

	it("requires a provable account for a legacy Google identity", () => {
		const legacyGoogleMapping = mapping({
			deliveryMethod: "google",
			syncStatus: "synced",
			deliverySyncStatus: "synced",
			calendarId: "primary",
			googleEventId: "legacy-event",
		});
		expect(
			resolveDeliveredCalendarIdentity({
				mapping: legacyGoogleMapping,
				legacyGoogleConnection: {
					id: "only-connection",
					googleAccountEmail: "calendar@example.com",
				},
			}),
		).toMatchObject({
			kind: "actionable",
			source: "legacy",
			target: { googleConnectionId: "only-connection" },
		});
		expect(
			resolveDeliveredCalendarIdentity({
				mapping: legacyGoogleMapping,
				legacyGoogleIdentityAmbiguous: true,
			}),
		).toMatchObject({ kind: "manual_reconciliation" });
	});
});
