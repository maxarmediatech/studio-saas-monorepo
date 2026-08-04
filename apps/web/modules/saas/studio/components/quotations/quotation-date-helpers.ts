function dateTimeParts(value: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).formatToParts(value);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((item) => item.type === type)?.value ?? "00";
	return {
		year: part("year"),
		month: part("month"),
		day: part("day"),
		hour: part("hour"),
		minute: part("minute"),
		second: part("second"),
	};
}

export function isoToDateTimeLocal(value: string, timeZone: string): string {
	const parts = dateTimeParts(new Date(value), timeZone);
	return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function dateTimeLocalToIso(value: string, timeZone: string): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
		value,
	);
	if (!match) {
		throw new Error("Invalid local date and time");
	}
	const desired = Date.UTC(
		Number(match[1]),
		Number(match[2]) - 1,
		Number(match[3]),
		Number(match[4]),
		Number(match[5]),
		Number(match[6] ?? 0),
	);
	let candidate = desired;
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const actual = dateTimeParts(new Date(candidate), timeZone);
		const actualAsUtc = Date.UTC(
			Number(actual.year),
			Number(actual.month) - 1,
			Number(actual.day),
			Number(actual.hour),
			Number(actual.minute),
			Number(actual.second),
		);
		candidate += desired - actualAsUtc;
	}
	return new Date(candidate).toISOString();
}

export function organizationDateToEndOfDayIso(
	date: string,
	timeZone: string,
): string {
	return dateTimeLocalToIso(`${date}T23:59:59`, timeZone).replace(
		/\.000Z$/,
		".999Z",
	);
}

export function isoToOrganizationDate(value: string, timeZone: string): string {
	return isoToDateTimeLocal(value, timeZone).slice(0, 10);
}
