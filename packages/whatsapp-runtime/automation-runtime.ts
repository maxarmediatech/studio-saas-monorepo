import {
	and,
	db,
	eq,
	inArray,
	isNotNull,
	isNull,
	lte,
	or,
	sql,
} from "@repo/database";
import {
	waAutomationActions,
	waAutomationRuns,
	waContacts,
	waConversations,
	waMessages,
} from "@repo/whatsapp-db";
import { parseAutomationAction } from "./automation-triggers";
import { ensureWhatsAppOutboxEffect } from "./identity-compat";
import type { AutomationAction, WhatsAppTransaction } from "./types";

const DEFAULT_LEASE_MS = 5 * 60 * 1000;

const runIsDue = (now: Date) =>
	or(
		and(
			eq(waAutomationRuns.status, "pending"),
			or(
				isNull(waAutomationRuns.nextAttemptAt),
				lte(waAutomationRuns.nextAttemptAt, now),
			),
		),
		and(
			inArray(waAutomationRuns.status, ["failed", "waiting"]),
			isNotNull(waAutomationRuns.nextAttemptAt),
			lte(waAutomationRuns.nextAttemptAt, now),
		),
	);

export const recoverExpiredAutomationLeases = async (now = new Date()) =>
	db.transaction(async (tx) => {
		const actions = await tx
			.update(waAutomationActions)
			.set({
				status: "pending",
				nextAttemptAt: now,
				lockedBy: null,
				leaseExpiresAt: null,
				lastError: "Recovered expired automation action lease",
				updatedAt: now,
			})
			.where(
				and(
					eq(waAutomationActions.status, "processing"),
					lte(waAutomationActions.leaseExpiresAt, now),
				),
			)
			.returning({ id: waAutomationActions.id });
		const runs = await tx
			.update(waAutomationRuns)
			.set({
				status: "pending",
				nextAttemptAt: now,
				lockedBy: null,
				leaseExpiresAt: null,
				lastError: "Recovered expired automation run lease",
				updatedAt: now,
			})
			.where(
				and(
					eq(waAutomationRuns.status, "processing"),
					lte(waAutomationRuns.leaseExpiresAt, now),
				),
			)
			.returning({ id: waAutomationRuns.id });
		return { actions: actions.length, runs: runs.length };
	});

const claimAutomationRun = async (params: {
	runId: string;
	workerId: string;
	now: Date;
	leaseMs: number;
}) =>
	db.transaction(async (tx) => {
		const leaseExpiresAt = new Date(params.now.getTime() + params.leaseMs);
		const [run] = await tx
			.update(waAutomationRuns)
			.set({
				status: "processing",
				attempts: sql`${waAutomationRuns.attempts} + 1`,
				lockedBy: params.workerId,
				leaseExpiresAt,
				nextAttemptAt: null,
				startedAt: sql`coalesce(${waAutomationRuns.startedAt}, ${params.now})`,
				updatedAt: params.now,
			})
			.where(
				and(
					eq(waAutomationRuns.id, params.runId),
					runIsDue(params.now),
				),
			)
			.returning();
		if (!run) {
			return null;
		}

		const [action] = await tx
			.select()
			.from(waAutomationActions)
			.where(
				and(
					eq(waAutomationActions.runId, run.id),
					eq(waAutomationActions.actionIndex, run.currentActionIndex),
				),
			)
			.limit(1);
		if (!action) {
			await tx
				.update(waAutomationRuns)
				.set({
					status: "completed",
					completedAt: params.now,
					lockedBy: null,
					leaseExpiresAt: null,
					updatedAt: params.now,
				})
				.where(eq(waAutomationRuns.id, run.id));
			return null;
		}

		const ready =
			(action.status === "waiting" &&
				action.waitUntil !== null &&
				action.waitUntil <= params.now) ||
			(["pending", "failed"].includes(action.status) &&
				(action.nextAttemptAt === null ||
					action.nextAttemptAt <= params.now) &&
				action.attempts < action.maxAttempts);
		if (!ready) {
			await tx
				.update(waAutomationRuns)
				.set({
					status: action.status === "waiting" ? "waiting" : "failed",
					nextAttemptAt: action.waitUntil ?? action.nextAttemptAt,
					lockedBy: null,
					leaseExpiresAt: null,
					updatedAt: params.now,
				})
				.where(eq(waAutomationRuns.id, run.id));
			return null;
		}

		const [claimedAction] = await tx
			.update(waAutomationActions)
			.set({
				status: "processing",
				attempts: sql`${waAutomationActions.attempts} + 1`,
				lockedBy: params.workerId,
				leaseExpiresAt,
				nextAttemptAt: null,
				updatedAt: params.now,
			})
			.where(eq(waAutomationActions.id, action.id))
			.returning();
		return claimedAction ? { run, action: claimedAction } : null;
	});

const ensureAutomationMessage = async (
	tx: WhatsAppTransaction,
	params: {
		run: typeof waAutomationRuns.$inferSelect;
		action: typeof waAutomationActions.$inferSelect;
		payload: Extract<
			AutomationAction,
			{ type: "send_text" | "send_template" }
		>;
	},
) => {
	const [created] = await tx
		.insert(waMessages)
		.values({
			organizationId: params.run.organizationId,
			accountId: params.run.accountId,
			conversationId: params.run.conversationId,
			contactId: params.run.contactId,
			direction: "outbound",
			type: params.payload.type === "send_text" ? "text" : "template",
			textBody:
				params.payload.type === "send_text"
					? params.payload.text
					: null,
			templateName:
				params.payload.type === "send_template"
					? params.payload.templateName
					: null,
			templateParams:
				params.payload.type === "send_text"
					? null
					: { language: params.payload.language, components: [] },
			status: "queued",
			statusUpdatedAt: new Date(),
			sentByBotFlowId: params.run.flowId,
			automationActionId: params.action.id,
		})
		.onConflictDoNothing({ target: waMessages.automationActionId })
		.returning({ id: waMessages.id, createdAt: waMessages.createdAt });
	const message =
		created ??
		(
			await tx
				.select({ id: waMessages.id, createdAt: waMessages.createdAt })
				.from(waMessages)
				.where(eq(waMessages.automationActionId, params.action.id))
				.limit(1)
		)[0];
	if (!message) {
		throw new Error("Failed to resolve automation message effect");
	}
	await ensureWhatsAppOutboxEffect(tx, {
		organizationId: params.run.organizationId,
		accountId: params.run.accountId,
		messageId: message.id,
	});
	await tx
		.update(waConversations)
		.set({
			lastMessageId: message.id,
			lastMessageAt: message.createdAt,
			lastMessagePreview:
				params.payload.type === "send_text"
					? params.payload.text
					: `Template: ${params.payload.templateName}`,
			updatedAt: new Date(),
		})
		.where(eq(waConversations.id, params.run.conversationId));
	return message.id;
};

const completeAction = async (
	tx: WhatsAppTransaction,
	run: typeof waAutomationRuns.$inferSelect,
	action: typeof waAutomationActions.$inferSelect,
	workerId: string,
	now: Date,
	messageId?: string,
) => {
	await tx
		.update(waAutomationActions)
		.set({
			status: "completed",
			messageId: messageId ?? action.messageId,
			completedAt: now,
			lockedBy: null,
			leaseExpiresAt: null,
			lastError: null,
			updatedAt: now,
		})
		.where(
			and(
				eq(waAutomationActions.id, action.id),
				eq(waAutomationActions.lockedBy, workerId),
			),
		);
	const [next] = await tx
		.select({ id: waAutomationActions.id })
		.from(waAutomationActions)
		.where(
			and(
				eq(waAutomationActions.runId, run.id),
				eq(waAutomationActions.actionIndex, action.actionIndex + 1),
			),
		)
		.limit(1);
	await tx
		.update(waAutomationRuns)
		.set({
			status: next ? "pending" : "completed",
			currentActionIndex: action.actionIndex + 1,
			nextAttemptAt: next ? now : null,
			completedAt: next ? null : now,
			lockedBy: null,
			leaseExpiresAt: null,
			lastError: null,
			updatedAt: now,
		})
		.where(
			and(
				eq(waAutomationRuns.id, run.id),
				eq(waAutomationRuns.lockedBy, workerId),
			),
		);
};

const executeClaimedAction = async (
	claim: NonNullable<Awaited<ReturnType<typeof claimAutomationRun>>>,
	workerId: string,
	now: Date,
) =>
	db.transaction(async (tx) => {
		const [run] = await tx
			.select()
			.from(waAutomationRuns)
			.where(
				and(
					eq(waAutomationRuns.id, claim.run.id),
					eq(waAutomationRuns.status, "processing"),
					eq(waAutomationRuns.lockedBy, workerId),
				),
			)
			.for("update");
		const [action] = await tx
			.select()
			.from(waAutomationActions)
			.where(
				and(
					eq(waAutomationActions.id, claim.action.id),
					eq(waAutomationActions.status, "processing"),
					eq(waAutomationActions.lockedBy, workerId),
				),
			)
			.for("update");
		if (!run || !action) {
			return "skipped" as const;
		}

		const payload = parseAutomationAction(action.payload);
		if (!payload) {
			throw new Error("Automation action payload is invalid");
		}
		if (payload.type === "wait") {
			if (!action.waitUntil) {
				const waitUntil = new Date(
					now.getTime() + payload.durationMinutes * 60_000,
				);
				await tx
					.update(waAutomationActions)
					.set({
						status: "waiting",
						waitUntil,
						lockedBy: null,
						leaseExpiresAt: null,
						updatedAt: now,
					})
					.where(eq(waAutomationActions.id, action.id));
				await tx
					.update(waAutomationRuns)
					.set({
						status: "waiting",
						nextAttemptAt: waitUntil,
						lockedBy: null,
						leaseExpiresAt: null,
						updatedAt: now,
					})
					.where(eq(waAutomationRuns.id, run.id));
				return "waiting" as const;
			}
			if (action.waitUntil > now) {
				throw new Error(
					"Automation wait action claimed before it was due",
				);
			}
			await completeAction(tx, run, action, workerId, now);
			return "completed" as const;
		}

		let messageId: string | undefined;
		if (payload.type === "send_text" || payload.type === "send_template") {
			messageId = await ensureAutomationMessage(tx, {
				run,
				action,
				payload,
			});
		} else if (payload.type === "add_tag") {
			await tx
				.update(waContacts)
				.set({
					tags: sql`case when coalesce(${waContacts.tags}, '[]'::jsonb) ? ${payload.tag} then coalesce(${waContacts.tags}, '[]'::jsonb) else coalesce(${waContacts.tags}, '[]'::jsonb) || jsonb_build_array(${payload.tag}::text) end`,
					updatedAt: now,
				})
				.where(eq(waContacts.id, run.contactId));
		} else if (payload.type === "assign_conversation") {
			await tx
				.update(waConversations)
				.set({ assignedToUserId: payload.userId, updatedAt: now })
				.where(eq(waConversations.id, run.conversationId));
		} else {
			await tx
				.update(waConversations)
				.set({ status: "closed", updatedAt: now })
				.where(eq(waConversations.id, run.conversationId));
		}
		await completeAction(tx, run, action, workerId, now, messageId);
		return "completed" as const;
	});

const failClaimedAction = async (
	claim: NonNullable<Awaited<ReturnType<typeof claimAutomationRun>>>,
	workerId: string,
	error: unknown,
	now: Date,
) => {
	const errorMessage =
		error instanceof Error ? error.message : "Automation failed";
	const retryAt =
		claim.action.attempts < claim.action.maxAttempts
			? new Date(
					now.getTime() +
						Math.min(claim.action.attempts * 30, 900) * 1000,
				)
			: null;
	await db.transaction(async (tx) => {
		await tx
			.update(waAutomationActions)
			.set({
				status: "failed",
				nextAttemptAt: retryAt,
				lockedBy: null,
				leaseExpiresAt: null,
				lastError: errorMessage,
				updatedAt: now,
			})
			.where(
				and(
					eq(waAutomationActions.id, claim.action.id),
					eq(waAutomationActions.lockedBy, workerId),
				),
			);
		await tx
			.update(waAutomationRuns)
			.set({
				status: "failed",
				nextAttemptAt: retryAt,
				lockedBy: null,
				leaseExpiresAt: null,
				lastError: errorMessage,
				updatedAt: now,
			})
			.where(
				and(
					eq(waAutomationRuns.id, claim.run.id),
					eq(waAutomationRuns.lockedBy, workerId),
				),
			);
	});
};

export const processAutomationRun = async (
	runId: string,
	options: { workerId: string; now?: Date; leaseMs?: number },
) => {
	const now = options.now ?? new Date();
	const claim = await claimAutomationRun({
		runId,
		workerId: options.workerId,
		now,
		leaseMs: options.leaseMs ?? DEFAULT_LEASE_MS,
	});
	if (!claim) {
		return { status: "skipped" as const };
	}
	try {
		return {
			status: await executeClaimedAction(claim, options.workerId, now),
		};
	} catch (error) {
		await failClaimedAction(claim, options.workerId, error, now);
		return { status: "failed" as const };
	}
};

export const processDueAutomationRuns = async ({
	workerId,
	limit = 20,
	now = new Date(),
}: {
	workerId: string;
	limit?: number;
	now?: Date;
}) => {
	await recoverExpiredAutomationLeases(now);
	const runs = await db
		.select({ id: waAutomationRuns.id })
		.from(waAutomationRuns)
		.where(runIsDue(now))
		.limit(limit);
	for (const run of runs) {
		await processAutomationRun(run.id, { workerId, now });
	}
	return runs.length;
};
