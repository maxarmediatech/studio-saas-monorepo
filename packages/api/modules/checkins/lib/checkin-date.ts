import { TZDate } from "@date-fns/tz";
import {
	addDays,
	addWeeks,
	format,
	isWeekend,
	startOfDay,
	startOfWeek,
} from "date-fns";

interface ComputeCheckinDateParams {
	/** Timestamp to compute the period for */
	at: Date;
	/** HH:MM or HH:MM:SS format */
	scheduledTime: string | null;
	frequency: "daily" | "weekdays" | "weekly";
	/** IANA timezone (e.g., "America/New_York") */
	timezone: string;
}

/**
 * Computes the current checkin period date (YYYY-MM-DD) in the provided timezone.
 *
 * The period boundary is the scheduled time:
 * - If now < scheduled time, the current period is considered "yesterday" (or prior valid day)
 * - If now >= scheduled time, the current period is considered "today" (or current valid day)
 */
export function computeCheckinDate({
	scheduledTime,
	frequency,
	timezone,
}: Omit<ComputeCheckinDateParams, "at">): string {
	return computeCheckinDateAt({
		at: new Date(),
		scheduledTime,
		frequency,
		timezone,
	});
}

export function computeCheckinDateAt({
	at,
	scheduledTime,
	frequency,
	timezone,
}: ComputeCheckinDateParams): string {
	const nowInTz = new TZDate(at, timezone);
	const todayInTz = startOfDay(nowInTz);

	if (!scheduledTime) {
		return format(todayInTz, "yyyy-MM-dd");
	}

	const timeParts = scheduledTime.split(":");
	const hours = Number.parseInt(timeParts[0], 10);
	const minutes = Number.parseInt(timeParts[1], 10);

	const scheduledToday = new TZDate(
		todayInTz.getFullYear(),
		todayInTz.getMonth(),
		todayInTz.getDate(),
		hours,
		minutes,
		0,
		timezone,
	);

	if (frequency === "weekly") {
		return format(
			getWeeklyPeriodDate(nowInTz, scheduledTime, timezone),
			"yyyy-MM-dd",
		);
	}

	let periodDate =
		nowInTz < scheduledToday ? addDays(todayInTz, -1) : todayInTz;

	if (frequency === "weekdays") {
		while (isWeekend(periodDate)) {
			periodDate = addDays(periodDate, -1);
		}
	}

	return format(periodDate, "yyyy-MM-dd");
}

function getWeeklyPeriodDate(
	nowInTz: Date,
	scheduledTime: string,
	timezone: string,
): Date {
	const timeParts = scheduledTime.split(":");
	const hours = Number.parseInt(timeParts[0], 10);
	const minutes = Number.parseInt(timeParts[1], 10);

	const weekStart = startOfWeek(startOfDay(nowInTz), { weekStartsOn: 1 });
	const scheduledOnWeekStart = new TZDate(
		weekStart.getFullYear(),
		weekStart.getMonth(),
		weekStart.getDate(),
		hours,
		minutes,
		0,
		timezone,
	);

	return nowInTz < scheduledOnWeekStart ? addWeeks(weekStart, -1) : weekStart;
}
