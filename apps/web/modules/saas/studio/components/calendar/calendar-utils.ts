import type {
	ShootDetail,
	ShootListItem,
} from "@repo/api/modules/studio/schemas/shoot";
import {
	eachDayOfInterval,
	endOfMonth,
	endOfWeek,
	format,
	parseISO,
	startOfMonth,
	startOfWeek,
} from "date-fns";

export const CALENDAR_WEEK_STARTS_ON = 0 as const;
export const CALENDAR_PAGE_LIMIT = 100;
export const DEFAULT_SHOOT_DURATION_MINUTES = 60;

type ShootCalendarTitleInput = {
	bookingName?: string | null;
	shootType: string;
	name: string;
};

export function getWeekStart(date: Date) {
	return startOfWeek(date, { weekStartsOn: CALENDAR_WEEK_STARTS_ON });
}

export function getWeekEnd(date: Date) {
	return endOfWeek(date, { weekStartsOn: CALENDAR_WEEK_STARTS_ON });
}

export function getWeekDays(date: Date) {
	return eachDayOfInterval({
		start: getWeekStart(date),
		end: getWeekEnd(date),
	});
}

export function getMonthStart(date: Date) {
	return startOfMonth(date);
}

export function getMonthEnd(date: Date) {
	return endOfMonth(date);
}

export function getMonthGridStart(date: Date) {
	return startOfWeek(getMonthStart(date), {
		weekStartsOn: CALENDAR_WEEK_STARTS_ON,
	});
}

export function getMonthGridEnd(date: Date) {
	return endOfWeek(getMonthEnd(date), {
		weekStartsOn: CALENDAR_WEEK_STARTS_ON,
	});
}

export function getMonthGridDays(date: Date) {
	return eachDayOfInterval({
		start: getMonthGridStart(date),
		end: getMonthGridEnd(date),
	});
}

export function formatWeekParam(date: Date) {
	return format(getWeekStart(date), "yyyy-MM-dd");
}

export function formatCalendarDate(date: Date) {
	return format(date, "yyyy-MM-dd");
}

export function getShootCalendarTitle(shoot: ShootCalendarTitleInput) {
	const bookingName = shoot.bookingName ?? null;
	const shootType = formatLabel(shoot.shootType);
	const shootName =
		shoot.name.trim().toLowerCase() === shoot.shootType.trim().toLowerCase()
			? null
			: shoot.name.trim();

	return [bookingName, shootType, shootName].filter(Boolean).join(" - ");
}

export function formatLabel(value: string) {
	return value
		.split("_")
		.map((part) =>
			part.length === 0
				? part
				: `${part[0]?.toUpperCase()}${part.slice(1)}`,
		)
		.join(" ");
}

export function getShootTimeLabel(
	shoot: Pick<ShootListItem | ShootDetail, "startTime" | "endTime">,
) {
	if (!shoot.startTime) {
		return "No time";
	}

	const startLabel = formatShootClockTime(shoot.startTime);
	if (!shoot.endTime) {
		return startLabel;
	}

	return `${startLabel} - ${formatShootClockTime(shoot.endTime)}`;
}

export function getShootLocation(
	shoot: Pick<ShootListItem | ShootDetail, "venue" | "venueAddress">,
) {
	return shoot.venue ?? shoot.venueAddress ?? null;
}

export function groupShootsByDay(shoots: ShootListItem[], days: Date[]) {
	const grouped = new Map<string, ShootListItem[]>();

	for (const day of days) {
		grouped.set(format(day, "yyyy-MM-dd"), []);
	}

	for (const shoot of shoots) {
		const dayKey = format(parseISO(shoot.shootDate), "yyyy-MM-dd");
		const shootsForDay = grouped.get(dayKey);

		if (shootsForDay) {
			shootsForDay.push(shoot);
		}
	}

	return grouped;
}

export function getShootStartDateTime(
	shoot: Pick<ShootListItem | ShootDetail, "shootDate" | "startTime">,
) {
	if (!shoot.startTime) {
		return null;
	}

	const parsed = parseShootDateTime(shoot.shootDate, shoot.startTime);
	return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

export function getShootEndDateTime(
	shoot: Pick<
		ShootListItem | ShootDetail,
		"shootDate" | "startTime" | "endTime"
	>,
) {
	const start = getShootStartDateTime(shoot);
	if (!start) {
		return null;
	}

	if (!shoot.endTime) {
		return new Date(
			start.getTime() + DEFAULT_SHOOT_DURATION_MINUTES * 60 * 1000,
		);
	}

	const parsedEnd = parseShootDateTime(shoot.shootDate, shoot.endTime);
	if (!parsedEnd || Number.isNaN(parsedEnd.getTime())) {
		return new Date(
			start.getTime() + DEFAULT_SHOOT_DURATION_MINUTES * 60 * 1000,
		);
	}

	if (parsedEnd <= start) {
		return new Date(
			start.getTime() + DEFAULT_SHOOT_DURATION_MINUTES * 60 * 1000,
		);
	}

	return parsedEnd;
}

export function formatShootClockTime(value: string) {
	const parsed = parseTimeValue(value);
	if (!parsed) {
		return value;
	}

	return format(parsed, "h:mm a");
}

function parseShootDateTime(date: string, time: string) {
	const normalizedTime = normalizeTimeValue(time);
	return normalizedTime ? new Date(`${date}T${normalizedTime}`) : null;
}

function parseTimeValue(value: string) {
	const normalizedTime = normalizeTimeValue(value);
	return normalizedTime ? new Date(`2000-01-01T${normalizedTime}`) : null;
}

function normalizeTimeValue(value: string) {
	const trimmed = value.trim();
	if (/^\d{2}:\d{2}$/.test(trimmed)) {
		return `${trimmed}:00`;
	}

	if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
		return trimmed;
	}

	return null;
}

export function getShootStatusAppearance(status: string) {
	const normalizedStatus = status.toLowerCase();

	if (normalizedStatus.includes("cancel")) {
		return {
			cardClassName: "border-red-200 bg-red-50/90 hover:bg-red-50",
			chipClassName: "bg-red-100 text-red-700",
			dotClassName: "bg-red-500",
		};
	}

	if (normalizedStatus.includes("complete")) {
		return {
			cardClassName:
				"border-emerald-200 bg-emerald-50/90 hover:bg-emerald-50",
			chipClassName: "bg-emerald-100 text-emerald-700",
			dotClassName: "bg-emerald-500",
		};
	}

	if (normalizedStatus.includes("progress")) {
		return {
			cardClassName: "border-blue-200 bg-blue-50/90 hover:bg-blue-50",
			chipClassName: "bg-blue-100 text-blue-700",
			dotClassName: "bg-blue-500",
		};
	}

	if (normalizedStatus.includes("confirm")) {
		return {
			cardClassName:
				"border-violet-200 bg-violet-50/90 hover:bg-violet-50",
			chipClassName: "bg-violet-100 text-violet-700",
			dotClassName: "bg-violet-500",
		};
	}

	if (normalizedStatus.includes("postpone")) {
		return {
			cardClassName: "border-amber-200 bg-amber-50/90 hover:bg-amber-50",
			chipClassName: "bg-amber-100 text-amber-700",
			dotClassName: "bg-amber-500",
		};
	}

	return {
		cardClassName: "border-neutral-200 bg-white hover:bg-neutral-50",
		chipClassName: "bg-neutral-200 text-neutral-700",
		dotClassName: "bg-neutral-500",
	};
}
