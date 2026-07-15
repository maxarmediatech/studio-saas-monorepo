import { google } from "googleapis";
import type { GoogleCalendarOAuthConfig } from "./oauth";

export interface GoogleAllDayEventInput {
	title: string;
	date: string; // YYYY-MM-DD
	location?: string | null;
	description?: string | null;
}

export interface GoogleEventResult {
	googleEventId: string;
	htmlLink: string | null;
}

export function createCalendarApiClient(params: {
	config: GoogleCalendarOAuthConfig;
	accessToken: string;
}) {
	const oauth2Client = new google.auth.OAuth2({
		clientId: params.config.clientId,
		clientSecret: params.config.clientSecret,
		redirectUri: params.config.redirectUri,
	});
	oauth2Client.setCredentials({ access_token: params.accessToken });
	return google.calendar({ version: "v3", auth: oauth2Client });
}

export async function createAllDayEvent(params: {
	config: GoogleCalendarOAuthConfig;
	accessToken: string;
	calendarId: string;
	input: GoogleAllDayEventInput;
	eventId?: string;
}): Promise<GoogleEventResult> {
	const calendar = createCalendarApiClient({
		config: params.config,
		accessToken: params.accessToken,
	});

	try {
		const res = await calendar.events.insert({
			calendarId: params.calendarId,
			requestBody: {
				id: params.eventId,
				summary: params.input.title,
				location: params.input.location ?? undefined,
				description: params.input.description ?? undefined,
				start: { date: params.input.date },
				end: { date: addDays(params.input.date, 1) },
			},
			sendUpdates: "all",
		});
		const googleEventId = res.data.id;
		if (!googleEventId) {
			throw new Error("Google Calendar did not return event id");
		}
		return {
			googleEventId,
			htmlLink: res.data.htmlLink ?? null,
		};
	} catch (error) {
		if (!params.eventId || getGoogleErrorStatus(error) !== 409) {
			throw error;
		}
		// A worker can crash after Google accepts the deterministic id but before
		// the result commits. Treat the conflict as a retry of that same create,
		// and converge the existing event to the immutable intent snapshot.
		await calendar.events.patch({
			calendarId: params.calendarId,
			eventId: params.eventId,
			requestBody: {
				summary: params.input.title,
				location: params.input.location ?? undefined,
				description: params.input.description ?? undefined,
				start: { date: params.input.date },
				end: { date: addDays(params.input.date, 1) },
			},
			sendUpdates: "all",
		});
		return { googleEventId: params.eventId, htmlLink: null };
	}
}

export async function updateAllDayEvent(params: {
	config: GoogleCalendarOAuthConfig;
	accessToken: string;
	calendarId: string;
	googleEventId: string;
	input: GoogleAllDayEventInput;
}): Promise<void> {
	const calendar = createCalendarApiClient({
		config: params.config,
		accessToken: params.accessToken,
	});

	await calendar.events.patch({
		calendarId: params.calendarId,
		eventId: params.googleEventId,
		requestBody: {
			summary: params.input.title,
			location: params.input.location ?? undefined,
			description: params.input.description ?? undefined,
			start: { date: params.input.date },
			end: { date: addDays(params.input.date, 1) },
		},
		sendUpdates: "all",
	});
}

export async function deleteEvent(params: {
	config: GoogleCalendarOAuthConfig;
	accessToken: string;
	calendarId: string;
	googleEventId: string;
}): Promise<void> {
	const calendar = createCalendarApiClient({
		config: params.config,
		accessToken: params.accessToken,
	});

	try {
		await calendar.events.delete({
			calendarId: params.calendarId,
			eventId: params.googleEventId,
			sendUpdates: "all",
		});
	} catch (error) {
		if (![404, 410].includes(getGoogleErrorStatus(error) ?? -1)) {
			throw error;
		}
	}
}

function getGoogleErrorStatus(error: unknown): number | undefined {
	if (!error || typeof error !== "object") {
		return undefined;
	}
	const candidate = error as {
		code?: number | string;
		response?: { status?: number };
	};
	const status = candidate.response?.status ?? candidate.code;
	if (typeof status === "number") {
		return status;
	}
	if (typeof status === "string" && /^\d+$/.test(status)) {
		return Number(status);
	}
	return undefined;
}

function addDays(date: string, days: number): string {
	const [y, m, d] = date.split("-").map((p) => Number.parseInt(p, 10));
	const dt = new Date(Date.UTC(y, m - 1, d + days));
	const yyyy = dt.getUTCFullYear();
	const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(dt.getUTCDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}
