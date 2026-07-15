import { describe, expect, it } from "vitest";
import { resolveCancellationEvidence } from "./calendar-cancellation-evidence";

function mapping(overrides: Record<string, unknown> = {}) {
	return {
		deliveryMethod: "ics",
		deliverySyncStatus: "pending",
		syncStatus: "pending",
		icalSequence: 0,
		...overrides,
	} as never;
}

describe("calendar cancellation evidence", () => {
	it("completes rows with no evidence of an external effect as a no-op", () => {
		expect(
			resolveCancellationEvidence({ mapping: mapping() }),
		).toMatchObject({
			kind: "no_effect",
		});
	});

	it("accepts complete immutable Google identity", () => {
		expect(
			resolveCancellationEvidence({
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
			resolveCancellationEvidence({
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

	it("accepts effect evidence retained only by an immutable snapshot", () => {
		expect(
			resolveCancellationEvidence({
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
			resolveCancellationEvidence({
				mapping: mapping({
					deliveredGeneration: 1,
					deliveredDeliveryMethod: "google",
					deliveredGoogleEventId: "event-1",
				}),
			}),
		).toMatchObject({ kind: "manual_reconciliation" });
	});
});
