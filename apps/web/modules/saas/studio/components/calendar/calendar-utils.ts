import type {
	ShootDetail,
	ShootListItem,
} from "@repo/api/modules/studio/schemas/shoot";
import {
	eachDayOfInterval,
	endOfWeek,
	format,
	parseISO,
	startOfWeek,
} from "date-fns";

export const CALENDAR_WEEK_STARTS_ON = 0 as const;
export const CALENDAR_PAGE_LIMIT = 100;

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
		return "All day";
	}

	if (!shoot.endTime) {
		return shoot.startTime;
	}

	return `${shoot.startTime} - ${shoot.endTime}`;
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
