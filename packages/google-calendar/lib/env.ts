import { getBaseUrl } from "@repo/utils";

export interface GoogleCalendarEnv {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
	stateSigningSecret: string;
	maxStateAgeSeconds: number;
}

export function getGoogleCalendarEnv(): GoogleCalendarEnv {
	const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
	const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
	const stateSigningSecret = process.env.INTEGRATIONS_OAUTH_STATE_SECRET;

	if (!clientId) {
		throw new Error("Missing GOOGLE_CALENDAR_CLIENT_ID");
	}
	if (!clientSecret) {
		throw new Error("Missing GOOGLE_CALENDAR_CLIENT_SECRET");
	}
	if (!stateSigningSecret) {
		throw new Error("Missing INTEGRATIONS_OAUTH_STATE_SECRET");
	}

	return {
		clientId,
		clientSecret,
		redirectUri: `${getBaseUrl()}/api/integrations/google-calendar/callback`,
		stateSigningSecret,
		maxStateAgeSeconds: 10 * 60,
	};
}
