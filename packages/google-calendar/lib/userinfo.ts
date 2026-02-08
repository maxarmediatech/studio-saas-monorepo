import { google } from "googleapis";
import type { GoogleCalendarOAuthConfig } from "./oauth";

export async function fetchGoogleAccountEmail(params: {
	config: GoogleCalendarOAuthConfig;
	accessToken: string;
}): Promise<string | null> {
	const oauth2Client = new google.auth.OAuth2({
		clientId: params.config.clientId,
		clientSecret: params.config.clientSecret,
		redirectUri: params.config.redirectUri,
	});
	oauth2Client.setCredentials({ access_token: params.accessToken });

	const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
	const res = await oauth2.userinfo.get();
	return res.data.email ?? null;
}
