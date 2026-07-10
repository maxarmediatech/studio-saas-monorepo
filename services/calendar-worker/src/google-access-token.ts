import { and, db, eq, googleCalendarConnections, isNull } from "@repo/database";
import {
	decryptToken,
	encryptToken,
	getGoogleCalendarEnv,
	refreshGoogleCalendarAccessToken,
} from "@repo/google-calendar";

export async function getGoogleAccessToken(params: {
	organizationId: string;
	userId: string;
	allowDisconnected?: boolean;
}) {
	const connection = await db.query.googleCalendarConnections.findFirst({
		where: and(
			eq(googleCalendarConnections.organizationId, params.organizationId),
			eq(googleCalendarConnections.userId, params.userId),
			params.allowDisconnected
				? undefined
				: isNull(googleCalendarConnections.disconnectedAt),
		),
	});

	if (!connection?.refreshToken) {
		throw new Error("Google Calendar not connected");
	}

	const env = getGoogleCalendarEnv();
	const config = {
		clientId: env.clientId,
		clientSecret: env.clientSecret,
		redirectUri: env.redirectUri,
	};
	const accessTokenExpiresAtMs =
		connection.accessTokenExpiresAt?.getTime() ?? 0;
	const hasValidAccessToken =
		Boolean(connection.accessToken) &&
		accessTokenExpiresAtMs - Date.now() > 60_000;

	if (hasValidAccessToken) {
		if (!connection.accessToken) {
			throw new Error("Missing encrypted access token");
		}
		return { config, accessToken: decryptToken(connection.accessToken) };
	}

	const refreshed = await refreshGoogleCalendarAccessToken({
		config,
		refreshToken: decryptToken(connection.refreshToken),
	});
	if (!refreshed.accessToken) {
		throw new Error("Failed to refresh Google access token");
	}

	await db
		.update(googleCalendarConnections)
		.set({
			accessToken: encryptToken(refreshed.accessToken),
			accessTokenExpiresAt: refreshed.accessTokenExpiresAt,
			scope: refreshed.scope,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(googleCalendarConnections.id, connection.id),
				eq(
					googleCalendarConnections.organizationId,
					params.organizationId,
				),
			),
		);

	return { config, accessToken: refreshed.accessToken };
}
