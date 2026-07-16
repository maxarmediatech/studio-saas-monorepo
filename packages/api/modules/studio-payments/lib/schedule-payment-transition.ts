import { ORPCError } from "@orpc/server";
import type { paymentSchedules } from "@repo/database";
import { centsToMoney, moneyToCents } from "../../studio/lib/money";

type PaymentSchedule = typeof paymentSchedules.$inferSelect;
type PaymentScheduleStatus = NonNullable<
	(typeof paymentSchedules.$inferInsert)["status"]
>;

export interface SchedulePaymentTransition {
	amount: string;
	amountCents: number;
	paidAmount: string;
	paidAmountCents: number;
	paidAt: Date | null;
	status: PaymentScheduleStatus;
}

export function buildSchedulePaymentTransition(
	schedule: Pick<
		PaymentSchedule,
		"amount" | "paidAmount" | "paidAt" | "status"
	>,
	amount: string,
	cancelledMessage: string,
): SchedulePaymentTransition {
	if (schedule.status === "cancelled") {
		throw new ORPCError("CONFLICT", { message: cancelledMessage });
	}

	const amountCents = moneyToCents(amount);
	if (!Number.isFinite(amountCents) || amountCents <= 0) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Amount must be greater than zero",
		});
	}

	const paidAmountCents = moneyToCents(schedule.paidAmount);
	const scheduleAmountCents = moneyToCents(schedule.amount);
	const remainingAmountCents = scheduleAmountCents - paidAmountCents;
	if (remainingAmountCents <= 0) {
		throw new ORPCError("CONFLICT", {
			message: "Schedule is already fully paid",
		});
	}
	if (amountCents > remainingAmountCents) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Amount cannot exceed remaining scheduled balance",
		});
	}

	const nextPaidAmountCents = paidAmountCents + amountCents;
	const status: PaymentScheduleStatus =
		nextPaidAmountCents >= scheduleAmountCents ? "completed" : "partial";

	return {
		amount: centsToMoney(amountCents),
		amountCents,
		paidAmount: centsToMoney(nextPaidAmountCents),
		paidAmountCents: nextPaidAmountCents,
		paidAt:
			status === "completed"
				? (schedule.paidAt ?? new Date())
				: schedule.paidAt,
		status,
	};
}
