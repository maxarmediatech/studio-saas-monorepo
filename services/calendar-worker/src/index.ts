import {
	and,
	calendarSyncJobs,
	crews,
	db,
	desc,
	eq,
	googleCalendarConnections,
	inArray,
	isNull,
	lte,
	or,
	organizations,
	shootAssignments,
	shootCalendarEvents,
	shoots,
} from "@repo/database";
import {
	buildShootAllDayEventInput,
	createAllDayEvent,
	createAllDayIcsFromGoogleInput,
	decryptToken,
	deleteEvent,
	encryptToken,
	getGoogleCalendarEnv,
	refreshGoogleCalendarAccessToken,
	updateAllDayEvent,
} from "@repo/google-calendar";
import { logger } from "@repo/logs";
import { sendCalendarInviteEmail } from "@repo/mail";

const pollIntervalMs = Number(process.env.CALENDAR_WORKER_INTERVAL_MS ?? 5000);
const batchSize = Number(process.env.CALENDAR_WORKER_BATCH_SIZE ?? 10);

function computeNextAttemptAt(attempts: number) {
	const delaySeconds = Math.min(30 * attempts, 15 * 60);
	return new Date(Date.now() + delaySeconds * 1000);
}

async function fetchJobBatch() {
	const now = new Date();
	return db
		.select({ job: calendarSyncJobs })
		.from(calendarSyncJobs)
		.where(
			and(
				inArray(calendarSyncJobs.status, ["pending", "failed"]),
				or(
					isNull(calendarSyncJobs.nextAttemptAt),
					lte(calendarSyncJobs.nextAttemptAt, now),
				),
			),
		)
		.orderBy(desc(calendarSyncJobs.createdAt))
		.limit(batchSize);
}

async function markJobAttempt(jobId: string, attempts: number) {
	await db
		.update(calendarSyncJobs)
		.set({
			status: "processing",
			attempts,
			lastAttemptAt: new Date(),
			lockedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(calendarSyncJobs.id, jobId));
}

async function markJobSuccess(jobId: string) {
	await db
		.update(calendarSyncJobs)
		.set({
			status: "completed",
			nextAttemptAt: null,
			lastError: null,
			updatedAt: new Date(),
		})
		.where(eq(calendarSyncJobs.id, jobId));
}

async function markJobFailure(params: {
	jobId: string;
	attempts: number;
	maxAttempts: number;
	errorMessage: string;
}) {
	const nextAttemptAt =
		params.attempts >= params.maxAttempts
			? null
			: computeNextAttemptAt(params.attempts);

	await db
		.update(calendarSyncJobs)
		.set({
			status: "failed",
			nextAttemptAt,
			lastError: params.errorMessage,
			updatedAt: new Date(),
		})
		.where(eq(calendarSyncJobs.id, params.jobId));
}

async function getGoogleAccessToken(params: {
	organizationId: string;
	userId: string;
}) {
	const connection = await db.query.googleCalendarConnections.findFirst({
		where: and(
			eq(googleCalendarConnections.organizationId, params.organizationId),
			eq(googleCalendarConnections.userId, params.userId),
			isNull(googleCalendarConnections.disconnectedAt),
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

	const now = Date.now();
	const accessTokenExpiresAtMs =
		connection.accessTokenExpiresAt?.getTime() ?? 0;
	const hasValidAccessToken =
		Boolean(connection.accessToken) &&
		accessTokenExpiresAtMs - now > 60_000;

	if (hasValidAccessToken) {
		if (!connection.accessToken) {
			throw new Error("Missing encrypted access token");
		}
		return {
			config,
			accessToken: decryptToken(connection.accessToken),
		};
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
		.where(eq(googleCalendarConnections.id, connection.id));

	return { config, accessToken: refreshed.accessToken };
}

async function buildEventInput(params: { shootId: string; crewId: string }) {
	const shoot = await db.query.shoots.findFirst({
		where: eq(shoots.id, params.shootId),
		with: {
			booking: {
				columns: { name: true, referenceNumber: true },
			},
		},
	});
	if (!shoot) {
		throw new Error("Shoot not found");
	}

	const crew = await db.query.crews.findFirst({
		where: eq(crews.id, params.crewId),
		columns: { name: true, email: true },
	});
	if (!crew) {
		throw new Error("Crew not found");
	}

	const assignment = await db.query.shootAssignments.findFirst({
		where: and(
			eq(shootAssignments.shootId, params.shootId),
			eq(shootAssignments.crewId, params.crewId),
		),
		columns: { role: true },
	});

	const org = await db.query.organizations.findFirst({
		where: eq(organizations.id, shoot.organizationId),
		columns: { slug: true },
	});

	const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
	const shootUrl = org?.slug
		? `${baseUrl}/app/${org.slug}/shoots/${shoot.id}`
		: null;

	return {
		crew,
		shoot,
		input: buildShootAllDayEventInput({
			shootName: shoot.name,
			shootType: shoot.shootType,
			shootDate: normalizeYmd(shoot.shootDate),
			startTime: shoot.startTime ? String(shoot.startTime) : null,
			venue: shoot.venue,
			venueAddress: shoot.venueAddress,
			notes: shoot.notes,
			bookingName: shoot.booking?.name ?? null,
			bookingReferenceNumber: shoot.booking?.referenceNumber ?? null,
			crewName: crew.name,
			crewRole: assignment?.role ?? null,
			shootUrl,
		}),
	};
}

function normalizeYmd(value: unknown): string {
	if (typeof value === "string") {
		// Drizzle date column often returns YYYY-MM-DD
		return value.slice(0, 10);
	}
	if (value instanceof Date) {
		const yyyy = value.getUTCFullYear();
		const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
		const dd = String(value.getUTCDate()).padStart(2, "0");
		return `${yyyy}-${mm}-${dd}`;
	}
	throw new Error("Invalid shootDate type");
}

async function processJob(job: typeof calendarSyncJobs.$inferSelect) {
	const attempts = (job.attempts ?? 0) + 1;
	const maxAttempts = job.maxAttempts ?? 5;
	await markJobAttempt(job.id, attempts);

	try {
		if (!job.shootId || !job.crewId) {
			throw new Error("Job missing shootId/crewId");
		}

		if (job.jobType.startsWith("google_")) {
			const crew = await db.query.crews.findFirst({
				where: eq(crews.id, job.crewId),
				columns: { userId: true },
			});
			if (!crew?.userId) {
				throw new Error("Crew has no linked userId");
			}

			const { config, accessToken } = await getGoogleAccessToken({
				organizationId: job.organizationId,
				userId: crew.userId,
			});

			const mapping = await db.query.shootCalendarEvents.findFirst({
				where: and(
					eq(shootCalendarEvents.organizationId, job.organizationId),
					eq(shootCalendarEvents.shootId, job.shootId),
					eq(shootCalendarEvents.crewId, job.crewId),
				),
			});

			const { input } = await buildEventInput({
				shootId: job.shootId,
				crewId: job.crewId,
			});

			if (job.jobType === "google_create") {
				if (mapping?.googleEventId) {
					await updateAllDayEvent({
						config,
						accessToken,
						googleEventId: mapping.googleEventId,
						input,
					});
				} else {
					const created = await createAllDayEvent({
						config,
						accessToken,
						input,
					});
					await db
						.update(shootCalendarEvents)
						.set({
							deliveryMethod: "google",
							calendarId: "primary",
							googleEventId: created.googleEventId,
							syncStatus: "synced",
							lastSyncedAt: new Date(),
							lastError: null,
							updatedAt: new Date(),
						})
						.where(
							and(
								eq(
									shootCalendarEvents.organizationId,
									job.organizationId,
								),
								eq(shootCalendarEvents.shootId, job.shootId),
								eq(shootCalendarEvents.crewId, job.crewId),
							),
						);
				}
			}

			if (job.jobType === "google_update") {
				if (!mapping?.googleEventId) {
					const created = await createAllDayEvent({
						config,
						accessToken,
						input,
					});
					await db
						.update(shootCalendarEvents)
						.set({
							deliveryMethod: "google",
							calendarId: "primary",
							googleEventId: created.googleEventId,
							syncStatus: "synced",
							lastSyncedAt: new Date(),
							lastError: null,
							updatedAt: new Date(),
						})
						.where(
							and(
								eq(
									shootCalendarEvents.organizationId,
									job.organizationId,
								),
								eq(shootCalendarEvents.shootId, job.shootId),
								eq(shootCalendarEvents.crewId, job.crewId),
							),
						);
				} else {
					await updateAllDayEvent({
						config,
						accessToken,
						googleEventId: mapping.googleEventId,
						input,
					});
					await db
						.update(shootCalendarEvents)
						.set({
							syncStatus: "synced",
							lastSyncedAt: new Date(),
							lastError: null,
							updatedAt: new Date(),
						})
						.where(
							and(
								eq(
									shootCalendarEvents.organizationId,
									job.organizationId,
								),
								eq(shootCalendarEvents.shootId, job.shootId),
								eq(shootCalendarEvents.crewId, job.crewId),
							),
						);
				}
			}

			if (job.jobType === "google_delete") {
				if (mapping?.googleEventId) {
					await deleteEvent({
						config,
						accessToken,
						googleEventId: mapping.googleEventId,
					});
				}

				await db
					.update(shootCalendarEvents)
					.set({
						syncStatus: "deleted",
						googleEventId: null,
						calendarId: null,
						lastSyncedAt: new Date(),
						lastError: null,
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(
								shootCalendarEvents.organizationId,
								job.organizationId,
							),
							eq(shootCalendarEvents.shootId, job.shootId),
							eq(shootCalendarEvents.crewId, job.crewId),
						),
					);
			}

			await markJobSuccess(job.id);
			return;
		}

		if (job.jobType.startsWith("ics_")) {
			const mapping = await db.query.shootCalendarEvents.findFirst({
				where: and(
					eq(shootCalendarEvents.organizationId, job.organizationId),
					eq(shootCalendarEvents.shootId, job.shootId),
					eq(shootCalendarEvents.crewId, job.crewId),
				),
			});
			if (!mapping?.recipientEmail) {
				throw new Error("Missing recipient email");
			}
			if (!mapping.icalUid) {
				throw new Error("Missing iCal UID");
			}

			const { input } = await buildEventInput({
				shootId: job.shootId,
				crewId: job.crewId,
			});

			const method =
				job.jobType === "ics_send_cancel" ? "CANCEL" : "REQUEST";
			const nextSequence =
				job.jobType === "ics_send_invite"
					? mapping.icalSequence
					: mapping.icalSequence + 1;

			const ics = createAllDayIcsFromGoogleInput({
				uid: mapping.icalUid,
				sequence: nextSequence,
				method,
				input,
			});

			const subjectPrefix =
				job.jobType === "ics_send_cancel"
					? "Cancelled"
					: "Calendar Invite";

			await sendCalendarInviteEmail({
				to: mapping.recipientEmail,
				subject: `${subjectPrefix}: ${input.title}`,
				text: input.description ?? input.title,
				html: input.description
					? `<pre style="white-space:pre-wrap">${escapeHtml(input.description)}</pre>`
					: undefined,
				icsFilename: `shoot-${job.shootId}.ics`,
				icsContent: ics,
			});

			await db
				.update(shootCalendarEvents)
				.set({
					deliveryMethod: "ics",
					icalSequence: nextSequence,
					syncStatus: method === "CANCEL" ? "deleted" : "synced",
					lastSyncedAt: new Date(),
					lastError: null,
					updatedAt: new Date(),
				})
				.where(eq(shootCalendarEvents.id, mapping.id));

			await markJobSuccess(job.id);
			return;
		}

		throw new Error(`Unsupported jobType: ${job.jobType}`);
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : String(error);
		logger.error("Calendar job failed", {
			jobId: job.id,
			jobType: job.jobType,
			error: errorMessage,
		});

		if (job.shootId && job.crewId) {
			await db
				.update(shootCalendarEvents)
				.set({
					syncStatus: "error",
					lastError: errorMessage,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(
							shootCalendarEvents.organizationId,
							job.organizationId,
						),
						eq(shootCalendarEvents.shootId, job.shootId),
						eq(shootCalendarEvents.crewId, job.crewId),
					),
				);
		}

		await markJobFailure({
			jobId: job.id,
			attempts,
			maxAttempts,
			errorMessage,
		});
	}
}

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

async function loop() {
	const batch = await fetchJobBatch();
	for (const row of batch) {
		await processJob(row.job);
	}
}

async function main() {
	logger.info("Calendar worker started", {
		pollIntervalMs,
		batchSize,
	});

	// eslint-disable-next-line no-constant-condition
	while (true) {
		try {
			await loop();
		} catch (error) {
			logger.error("Calendar worker loop failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
		await new Promise((r) => setTimeout(r, pollIntervalMs));
	}
}

void main();
