import { google } from "googleapis";

export interface GoogleCalendarOAuthConfig {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
}

export interface GoogleCalendarTokenResponse {
	accessToken: string | null;
	refreshToken: string | null;
	scope: string | null;
	accessTokenExpiresAt: Date | null;
	idToken: string | null;
}

export const googleCalendarScopes = [
	"openid",
	"email",
	"https://www.googleapis.com/auth/calendar.events",
] as const;

export function createGoogleOAuthClient(config: GoogleCalendarOAuthConfig) {
	return new google.auth.OAuth2({
		clientId: config.clientId,
		clientSecret: config.clientSecret,
		redirectUri: config.redirectUri,
	});
}

export function getGoogleCalendarAuthUrl(params: {
	config: GoogleCalendarOAuthConfig;
	state: string;
}) {
	const client = createGoogleOAuthClient(params.config);
	return client.generateAuthUrl({
		access_type: "offline",
		prompt: "consent",
		scope: [...googleCalendarScopes],
		state: params.state,
	});
}

export async function exchangeGoogleCalendarCode(params: {
	config: GoogleCalendarOAuthConfig;
	code: string;
}): Promise<GoogleCalendarTokenResponse> {
	const client = createGoogleOAuthClient(params.config);
	const { tokens } = await client.getToken(params.code);

	return {
		accessToken: tokens.access_token ?? null,
		refreshToken: tokens.refresh_token ?? null,
		scope: tokens.scope ?? null,
		accessTokenExpiresAt: tokens.expiry_date
			? new Date(tokens.expiry_date)
			: null,
		idToken: tokens.id_token ?? null,
	};
}

export async function revokeGoogleToken(params: {
	config: GoogleCalendarOAuthConfig;
	token: string;
}): Promise<void> {
	const client = createGoogleOAuthClient(params.config);
	await client.revokeToken(params.token);
}

export async function refreshGoogleCalendarAccessToken(params: {
	config: GoogleCalendarOAuthConfig;
	refreshToken: string;
}): Promise<
	Pick<
		GoogleCalendarTokenResponse,
		"accessToken" | "accessTokenExpiresAt" | "scope"
	>
> {
	const client = createGoogleOAuthClient(params.config);
	client.setCredentials({ refresh_token: params.refreshToken });
	await client.getAccessToken();
	const tokens = client.credentials;
	return {
		accessToken: tokens.access_token ?? null,
		accessTokenExpiresAt: tokens.expiry_date
			? new Date(tokens.expiry_date)
			: null,
		scope: tokens.scope ?? null,
	};
}
