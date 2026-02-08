import type { GoogleAllDayEventInput } from "./calendar";

export type IcsMethod = "REQUEST" | "CANCEL";

export interface AllDayIcsParams {
	uid: string;
	sequence: number;
	method: IcsMethod;
	date: string; // YYYY-MM-DD
	summary: string;
	description?: string | null;
	location?: string | null;
}

export function createAllDayIcs(params: AllDayIcsParams): string {
	const dtstamp = formatUtcTimestamp(new Date());
	const dtstart = formatIcsDate(params.date);
	const dtend = formatIcsDate(addDays(params.date, 1));

	const lines: string[] = [];
	lines.push("BEGIN:VCALENDAR");
	lines.push("PRODID:-//Studio SaaS//Calendar//EN");
	lines.push("VERSION:2.0");
	lines.push("CALSCALE:GREGORIAN");
	lines.push(`METHOD:${params.method}`);
	lines.push("BEGIN:VEVENT");
	lines.push(`UID:${escapeIcsText(params.uid)}`);
	lines.push(`DTSTAMP:${dtstamp}`);
	lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
	lines.push(`DTEND;VALUE=DATE:${dtend}`);
	lines.push(`SEQUENCE:${Math.max(0, params.sequence)}`);
	lines.push(`SUMMARY:${escapeIcsText(params.summary)}`);

	if (params.location) {
		lines.push(`LOCATION:${escapeIcsText(params.location)}`);
	}
	if (params.description) {
		lines.push(`DESCRIPTION:${escapeIcsText(params.description)}`);
	}

	if (params.method === "CANCEL") {
		lines.push("STATUS:CANCELLED");
	}

	lines.push("END:VEVENT");
	lines.push("END:VCALENDAR");

	return `${foldIcsLines(lines).join("\r\n")}\r\n`;
}

export function createAllDayIcsFromGoogleInput(params: {
	uid: string;
	sequence: number;
	method: IcsMethod;
	input: GoogleAllDayEventInput;
}): string {
	return createAllDayIcs({
		uid: params.uid,
		sequence: params.sequence,
		method: params.method,
		date: params.input.date,
		summary: params.input.title,
		description: params.input.description ?? null,
		location: params.input.location ?? null,
	});
}

function escapeIcsText(value: string): string {
	return value
		.replaceAll("\\", "\\\\")
		.replaceAll("\r\n", "\\n")
		.replaceAll("\n", "\\n")
		.replaceAll(",", "\\,")
		.replaceAll(";", "\\;");
}

function foldIcsLines(lines: string[]): string[] {
	// RFC 5545 recommends 75 octets/line. We approximate by folding at 73 chars.
	const out: string[] = [];
	for (const line of lines) {
		if (line.length <= 73) {
			out.push(line);
			continue;
		}

		out.push(line.slice(0, 73));
		let rest = line.slice(73);
		while (rest.length > 0) {
			out.push(` ${rest.slice(0, 72)}`);
			rest = rest.slice(72);
		}
	}
	return out;
}

function formatIcsDate(date: string): string {
	const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) {
		throw new Error("Invalid date format (expected YYYY-MM-DD)");
	}
	return `${match[1]}${match[2]}${match[3]}`;
}

function formatUtcTimestamp(date: Date): string {
	const yyyy = date.getUTCFullYear();
	const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(date.getUTCDate()).padStart(2, "0");
	const hh = String(date.getUTCHours()).padStart(2, "0");
	const mi = String(date.getUTCMinutes()).padStart(2, "0");
	const ss = String(date.getUTCSeconds()).padStart(2, "0");
	return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function addDays(date: string, days: number): string {
	const [y, m, d] = date.split("-").map((p) => Number.parseInt(p, 10));
	const dt = new Date(Date.UTC(y, m - 1, d + days));
	const yyyy = dt.getUTCFullYear();
	const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(dt.getUTCDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}
