import { moneyToCents } from "../../studio/lib/money";

interface ActiveSchedulePayment {
	amount: string;
	receivedDate: string | Date;
}

function toDateOnly(value: string | Date): string {
	return typeof value === "string"
		? value.slice(0, 10)
		: value.toISOString().slice(0, 10);
}

export function deriveScheduleCompletionDate(
	scheduleAmount: string,
	activePayments: ActiveSchedulePayment[],
): Date | null {
	const scheduleAmountCents = moneyToCents(scheduleAmount);
	let runningTotalCents = 0;

	for (const payment of [...activePayments].sort((left, right) =>
		toDateOnly(left.receivedDate).localeCompare(
			toDateOnly(right.receivedDate),
		),
	)) {
		runningTotalCents += moneyToCents(payment.amount);
		if (runningTotalCents >= scheduleAmountCents) {
			return new Date(
				`${toDateOnly(payment.receivedDate)}T00:00:00.000Z`,
			);
		}
	}

	return null;
}

export function getCorrectedSchedulePaidAt(input: {
	wasCompleted: boolean;
	previousPaidAt: Date | null;
	scheduleAmount: string;
	activePayments: ActiveSchedulePayment[];
}): Date | null {
	const derivedCompletionDate = deriveScheduleCompletionDate(
		input.scheduleAmount,
		input.activePayments,
	);
	if (!derivedCompletionDate) {
		return null;
	}
	if (input.wasCompleted && input.previousPaidAt) {
		return input.previousPaidAt;
	}
	return derivedCompletionDate;
}
