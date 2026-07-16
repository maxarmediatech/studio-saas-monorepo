import {
	and,
	calendarDeliveryIntents,
	calendarSyncJobs,
	db,
	eq,
	googleCalendarConnections,
	isNotNull,
	isNull,
	ne,
} from "@repo/database";
import {
	decryptToken,
	getGoogleCalendarEnv,
	revokeGoogleToken,
} from "@repo/google-calendar";

export async function revokeCleanedUpConnections() {
	const connections = await db.query.googleCalendarConnections.findMany({
		where: and(
			isNotNull(googleCalendarConnections.disconnectedAt),
			isNull(googleCalendarConnections.revokedAt),
		),
	});
	for (const connection of connections) {
		const [pending] = await db
			.select({ id: calendarSyncJobs.id })
			.from(calendarSyncJobs)
			.innerJoin(
				calendarDeliveryIntents,
				eq(calendarSyncJobs.intentId, calendarDeliveryIntents.id),
			)
			.where(
				and(
					eq(
						calendarDeliveryIntents.googleConnectionId,
						connection.id,
					),
					ne(calendarSyncJobs.status, "completed"),
				),
			)
			.limit(1);
		if (pending) {
			continue;
		}
		const encryptedToken =
			connection.accessToken ?? connection.refreshToken;
		if (encryptedToken) {
			const env = getGoogleCalendarEnv();
			await revokeGoogleToken({
				config: {
					clientId: env.clientId,
					clientSecret: env.clientSecret,
					redirectUri: env.redirectUri,
				},
				token: decryptToken(encryptedToken),
			});
		}
		await db
			.update(googleCalendarConnections)
			.set({
				revokedAt: new Date(),
				accessToken: null,
				refreshToken: null,
				updatedAt: new Date(),
			})
			.where(eq(googleCalendarConnections.id, connection.id));
	}
}
