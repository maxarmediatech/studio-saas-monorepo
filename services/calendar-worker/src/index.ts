import {
	and,
	calendarSyncJobs,
	crews,
	db,
	eq,
	inArray,
	isNotNull,
	isNull,
	lte,
	shootCalendarEvents,
	sql,
} from "@repo/database";
import {
	createAllDayEvent,
	createAllDayIcsFromGoogleInput,
	deleteEvent,
	updateAllDayEvent,
} from "@repo/google-calendar";
import { logger } from "@repo/logs";
import { sendCalendarInviteEmail } from "@repo/mail";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildEventInput } from "./event-input";
import { getGoogleAccessToken } from "./google-access-token";
import {
	computeNextAttemptAfterFailure,
	DEFAULT_MAX_ATTEMPTS,
} from "./queue-helpers";

const pollIntervalMs = Number(process.env.CALENDAR_WORKER_INTERVAL_MS ?? 5000);
const batchSize = Number(process.env.CALENDAR_WORKER_BATCH_SIZE ?? 10);
const staleThresholdMinutesRaw = Number(
	process.env.CALENDAR_WORKER_STALE_THRESHOLD_MINUTES ?? 15,
);
const staleThresholdMinutes =
	Number.isFinite(staleThresholdMinutesRaw) && staleThresholdMinutesRaw > 0
		? staleThresholdMinutesRaw
		: 15;

export async function claimJobBatch() {
	const now = new Date();
	return db.transaction(async (tx) => {
		const claimableQuery = sql`
			SELECT id FROM ${calendarSyncJobs}
			WHERE (
				${calendarSyncJobs.status} = 'pending'
				OR (
					${calendarSyncJobs.status} = 'failed'
					AND COALESCE(${calendarSyncJobs.attempts}, 0) < COALESCE(${calendarSyncJobs.maxAttempts}, ${DEFAULT_MAX_ATTEMPTS})
				)
			)
			AND (
				${calendarSyncJobs.nextAttemptAt} IS NULL
				OR ${calendarSyncJobs.nextAttemptAt} <= ${now}
			)
			ORDER BY ${calendarSyncJobs.createdAt} ASC
			LIMIT ${batchSize}
			FOR UPDATE SKIP LOCKED
		`;

		const claimableResult = await tx.execute(claimableQuery);
		const jobIds = (claimableResult.rows as { id: string }[]).map(
			(row) => row.id,
		);

		if (jobIds.length === 0) {
			return [];
		}

		await tx
			.update(calendarSyncJobs)
			.set({
				status: "processing",
				attempts: sql`COALESCE(${calendarSyncJobs.attempts}, 0) + 1`,
				lastAttemptAt: now,
				lockedAt: now,
				updatedAt: now,
			})
			.where(inArray(calendarSyncJobs.id, jobIds));

		return tx
			.select()
			.from(calendarSyncJobs)
			.where(inArray(calendarSyncJobs.id, jobIds));
	});
}

export async function recoverStaleProcessingJobs() {
	const threshold = new Date(Date.now() - staleThresholdMinutes * 60 * 1000);
	const recoveredJobs = await db
		.update(calendarSyncJobs)
		.set({
			status: "failed",
			nextAttemptAt: sql`CASE
				WHEN COALESCE(${calendarSyncJobs.attempts}, 0) < COALESCE(${calendarSyncJobs.maxAttempts}, ${DEFAULT_MAX_ATTEMPTS})
				THEN NOW()
				ELSE NULL
			END`,
			lastError: "Recovered stale processing lock",
			lockedAt: null,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(calendarSyncJobs.status, "processing"),
				isNotNull(calendarSyncJobs.lockedAt),
				lte(calendarSyncJobs.lockedAt, threshold),
			),
		)
		.returning({ id: calendarSyncJobs.id });

	if (recoveredJobs.length > 0) {
		logger.warn("Recovered stale calendar sync jobs", {
			count: recoveredJobs.length,
			staleThresholdMinutes,
		});
	}

	return recoveredJobs;
}

async function markJobSuccess(jobId: string) {
	await db
		.update(calendarSyncJobs)
		.set({
			status: "completed",
			nextAttemptAt: null,
			lastError: null,
			lockedAt: null,
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
	const nextAttemptAt = computeNextAttemptAfterFailure({
		attempts: params.attempts,
		maxAttempts: params.maxAttempts,
	});

	await db
		.update(calendarSyncJobs)
		.set({
			status: "failed",
			nextAttemptAt,
			lastError: params.errorMessage,
			lockedAt: null,
			updatedAt: new Date(),
		})
		.where(eq(calendarSyncJobs.id, params.jobId));
}

async function processJob(job: typeof calendarSyncJobs.$inferSelect) {
	const attempts = job.attempts ?? 0;
	const maxAttempts = job.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

	try {
		if (!job.shootId || !job.crewId) {
			throw new Error("Job missing shootId/crewId");
		}

		if (job.jobType.startsWith("google_")) {
			const crew = await db.query.crews.findFirst({
				where: and(
					eq(crews.id, job.crewId),
					eq(crews.organizationId, job.organizationId),
					isNull(crews.deletedAt),
				),
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
			if (!mapping || mapping.deliveryMethod !== "google") {
				throw new Error(
					"Google calendar mapping not found for this organization",
				);
			}

			const { input } = await buildEventInput({
				organizationId: job.organizationId,
				shootId: job.shootId,
				crewId: job.crewId,
				allowMissingAssignment: job.jobType === "google_delete",
			});

			if (job.jobType === "google_create") {
				if (mapping?.googleEventId) {
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
						.where(eq(shootCalendarEvents.id, mapping.id));
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
			if (!mapping || mapping.deliveryMethod !== "ics") {
				throw new Error(
					"ICS calendar mapping not found for this organization",
				);
			}
			if (!mapping.icalUid) {
				throw new Error("Missing iCal UID");
			}

			const { crew, input } = await buildEventInput({
				organizationId: job.organizationId,
				shootId: job.shootId,
				crewId: job.crewId,
				allowMissingAssignment: job.jobType === "ics_send_cancel",
			});
			const recipientEmail = crew.email?.trim();
			if (!recipientEmail) {
				throw new Error("Crew has no current email address");
			}

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
				to: recipientEmail,
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
					recipientEmail,
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

		const [currentJob] = await db
			.select({ jobType: calendarSyncJobs.jobType })
			.from(calendarSyncJobs)
			.where(eq(calendarSyncJobs.id, job.id));

		// A producer may have replaced this job's route while it was leased. The
		// claimed snapshot must not overwrite the current route's mapping state.
		if (job.shootId && job.crewId && currentJob?.jobType === job.jobType) {
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
	await recoverStaleProcessingJobs();
	const batch = await claimJobBatch();
	for (const job of batch) {
		await processJob(job);
	}
}

async function main() {
	logger.info("Calendar worker started", {
		pollIntervalMs,
		batchSize,
		staleThresholdMinutes,
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

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
	void main();
}
