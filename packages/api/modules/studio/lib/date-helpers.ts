const DEFAULT_TIMEZONE = "UTC";

const WEEKDAY_INDEX: Record<string, number> = {
	sun: 0,
	mon: 1,
	tue: 2,
	wed: 3,
	thu: 4,
	fri: 5,
	sat: 6,
};

export function normalizeTimeZone(timeZone: string | null | undefined): string {
	if (!timeZone) {
		return DEFAULT_TIMEZONE;
	}

	try {
		new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
		return timeZone;
	} catch {
		return DEFAULT_TIMEZONE;
	}
}

export function getDateParts(date: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		weekday: "short",
	}).formatToParts(date);
	const year = parts.find((part) => part.type === "year")?.value;
	const month = parts.find((part) => part.type === "month")?.value;
	const day = parts.find((part) => part.type === "day")?.value;
	const weekday = parts.find((part) => part.type === "weekday")?.value;

	if (!year || !month || !day) {
		const fallback = date.toISOString().split("T")[0];
		const [fallbackYear, fallbackMonth, fallbackDay] = fallback.split("-");
		return {
			year: fallbackYear,
			month: fallbackMonth,
			day: fallbackDay,
			weekdayIndex: date.getUTCDay(),
		};
	}

	const weekdayKey = weekday?.slice(0, 3).toLowerCase();
	const weekdayIndex = weekdayKey
		? WEEKDAY_INDEX[weekdayKey] ?? date.getUTCDay()
		: date.getUTCDay();

	return { year, month, day, weekdayIndex };
}

export function formatDateParts(parts: { year: string; month: string; day: string }) {
	return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addDays(dateString: string, days: number) {
	const [year, month, day] = dateString.split("-").map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().split("T")[0];
}

export function getStartOfWeek(
	parts: { year: string; month: string; day: string; weekdayIndex: number },
	weekStartsOn = 0,
) {
	const base = new Date(
		Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
	);
	const diff = (parts.weekdayIndex - weekStartsOn + 7) % 7;
	base.setUTCDate(base.getUTCDate() - diff);
	return base.toISOString().split("T")[0];
}
