function getPart(
	parts: Intl.DateTimeFormatPart[],
	type: Intl.DateTimeFormatPartTypes,
) {
	return parts.find((part) => part.type === type)?.value;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(kind: "date" | "clock" | "zone", timeZone: string) {
	const cacheKey = `${kind}:${timeZone}`;
	const cached = formatterCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const options: Intl.DateTimeFormatOptions =
		kind === "date"
			? { day: "2-digit", month: "2-digit", timeZone, year: "numeric" }
			: kind === "clock"
				? {
						hour: "2-digit",
						hourCycle: "h23",
						minute: "2-digit",
						timeZone,
					}
				: { timeZone, timeZoneName: "short" };
	// oxlint-disable-next-line react-doctor/js-hoist-intl -- dynamic formatters are cached by kind and IANA timezone.
	const formatter = new Intl.DateTimeFormat(
		kind === "date" ? "en-CA" : "en-US",
		options,
	);
	formatterCache.set(cacheKey, formatter);
	return formatter;
}

export function getCalendarDateKey(date: Date, timeZone: string) {
	const parts = getFormatter("date", timeZone).formatToParts(date);
	const year = getPart(parts, "year");
	const month = getPart(parts, "month");
	const day = getPart(parts, "day");

	return year && month && day ? `${year}-${month}-${day}` : null;
}

export function getMinutesSinceMidnight(date: Date, timeZone: string) {
	const parts = getFormatter("clock", timeZone).formatToParts(date);
	const hour = Number(getPart(parts, "hour"));
	const minute = Number(getPart(parts, "minute"));

	return hour * 60 + minute;
}

export function getTimeZoneLabel(date: Date, timeZone: string) {
	const parts = getFormatter("zone", timeZone).formatToParts(date);

	return getPart(parts, "timeZoneName") ?? timeZone;
}
