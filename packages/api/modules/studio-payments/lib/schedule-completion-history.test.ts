import { describe, expect, it } from "vitest";
import {
	deriveScheduleCompletionDate,
	getCorrectedSchedulePaidAt,
} from "./schedule-completion-history";

const activePayments = [
	{ amount: "30.00", receivedDate: "2026-01-12" },
	{ amount: "40.00", receivedDate: "2026-01-05" },
	{ amount: "30.00", receivedDate: "2026-01-10" },
];

describe("schedule completion history", () => {
	it("derives the date when chronological active payments cross completion", () => {
		expect(deriveScheduleCompletionDate("100.00", activePayments)).toEqual(
			new Date("2026-01-12T00:00:00.000Z"),
		);
	});

	it("preserves the historical timestamp across completed corrections", () => {
		const historicalPaidAt = new Date("2025-12-20T08:15:00.000Z");
		expect(
			getCorrectedSchedulePaidAt({
				wasCompleted: true,
				previousPaidAt: historicalPaidAt,
				scheduleAmount: "100.00",
				activePayments,
			}),
		).toEqual(historicalPaidAt);
	});

	it("clears the timestamp when correction leaves the schedule partial", () => {
		expect(
			getCorrectedSchedulePaidAt({
				wasCompleted: true,
				previousPaidAt: new Date("2025-12-20T08:15:00.000Z"),
				scheduleAmount: "110.00",
				activePayments,
			}),
		).toBeNull();
	});

	it("uses active payment history when correction newly completes", () => {
		expect(
			getCorrectedSchedulePaidAt({
				wasCompleted: false,
				previousPaidAt: null,
				scheduleAmount: "100.00",
				activePayments,
			}),
		).toEqual(new Date("2026-01-12T00:00:00.000Z"));
	});
});
