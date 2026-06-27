import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseComposerTarget } from "../../../shared/composer-target";
import {
	type ConversationDatabase,
	openConversationDatabase,
} from "../../storage/database";
import type { ValidatedAdmittedComposerRequest } from "../admitted-request";
import { ConversationRepository } from "../repository";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("ConversationRepository", () => {
	it("keeps setTurnRunning as a monotonic transition", () => {
		const run = vi.fn((_input?: unknown) => ({ changes: 0 }));
		let sql = "";
		const db = {
			prepare: vi.fn((statement: string) => {
				sql = statement;
				return { run };
			}),
		};
		const repo = new ConversationRepository(db as never);

		const result = repo.setTurnRunning({
			turnId: "turn-1",
			providerTurnId: "provider-turn-late",
			now: "2026-06-25T00:00:02.000Z",
		});

		expect(result).toBeUndefined();
		expect(sql).toContain(
			"status IN ('queued', 'running', 'waiting_approval')",
		);
		expect(run).toHaveBeenCalledWith({
			turnId: "turn-1",
			providerTurnId: "provider-turn-late",
			now: "2026-06-25T00:00:02.000Z",
		});
	});

	it("does not apply message or admitted side effects when terminal completion loses", () => {
		const statements: string[] = [];
		const run = vi.fn((_input?: unknown) => ({ changes: 0 }));
		const get = vi.fn(() => turnRow({ status: "completed" }));
		const db = {
			prepare: vi.fn((statement: string) => {
				statements.push(statement);
				return statement.startsWith("SELECT") ? { get } : { run };
			}),
		};
		const repo = new ConversationRepository(db as never);

		const result = repo.completeTurn({
			turnId: "turn-1",
			raw: { type: "final_answer" },
			status: "completed",
			now: "2026-06-25T00:00:02.000Z",
		});

		expect(result).toBeUndefined();
		expect(statements.join("\n")).toContain(
			"status IN ('queued', 'running', 'waiting_approval')",
		);
		expect(statements.join("\n")).not.toContain("UPDATE messages");
		expect(statements.join("\n")).not.toContain("UPDATE admitted_requests");
	});

	it("projects accepted terminal turn status to admitted requests", () => {
		const statements: string[] = [];
		const run = vi.fn((_input?: unknown) => ({ changes: 1 }));
		const get = vi.fn(() => turnRow({ status: "running" }));
		const db = {
			prepare: vi.fn((statement: string) => {
				statements.push(statement);
				return statement.startsWith("SELECT") ? { get } : { run };
			}),
		};
		const repo = new ConversationRepository(db as never);

		repo.completeTurn({
			turnId: "turn-1",
			raw: { type: "final_answer" },
			status: "completed",
			now: "2026-06-25T00:00:02.000Z",
		});

		const admittedCall = run.mock.calls.find(
			([input]) =>
				typeof input === "object" &&
				input !== null &&
				"turnId" in input &&
				"status" in input &&
				(input as { status?: unknown }).status === "completed",
		);
		expect(statements.join("\n")).toContain("UPDATE admitted_requests");
		expect(statements.join("\n")).toContain(
			"status NOT IN ('completed', 'failed', 'canceled')",
		);
		expect(admittedCall?.[0]).toEqual({
			turnId: "turn-1",
			status: "completed",
			error: null,
			now: "2026-06-25T00:00:02.000Z",
		});
	});

	it("projects interrupted turns to canceled admitted requests", () => {
		const run = vi.fn((_input?: unknown) => ({ changes: 1 }));
		const get = vi.fn(() => turnRow({ status: "running" }));
		const db = {
			prepare: vi.fn((statement: string) =>
				statement.startsWith("SELECT") ? { get } : { run },
			),
		};
		const repo = new ConversationRepository(db as never);

		repo.interruptTurn({
			turnId: "turn-1",
			message: "Interrupted",
			now: "2026-06-25T00:00:02.000Z",
		});

		const admittedCall = run.mock.calls.find(
			([input]) =>
				typeof input === "object" &&
				input !== null &&
				"turnId" in input &&
				"status" in input &&
				(input as { status?: unknown }).status === "canceled",
		);
		expect(admittedCall?.[0]).toEqual({
			turnId: "turn-1",
			status: "canceled",
			error: JSON.stringify({ message: "Interrupted" }),
			now: "2026-06-25T00:00:02.000Z",
		});
	});

	it("recovers running queue items as failed on restart", () => {
		const { db, repo } = createRepo();
		const now = "2026-06-26T00:00:00.000Z";
		insertQueuedConversation(db, "conversation-1");
		repo.recordAdmittedRequest({
			request: admittedRequest("admitted-1", "Run later"),
			conversationId: "conversation-1",
			status: "queued",
			now,
		});
		const queue = repo.createQueueItem({
			id: "queue-1",
			conversationId: "conversation-1",
			admittedRequestId: "admitted-1",
			now,
		});
		repo.updateQueueItem({
			queueItemId: queue.id,
			status: "running",
			now,
		});

		repo.recoverInterruptedState("2026-06-26T00:01:00.000Z");

		const [item] = repo.listQueueItemsForConversation("conversation-1");
		expect(item).toMatchObject({
			id: "queue-1",
			status: "failed",
			error: "Queue execution interrupted by app restart",
		});
		db.close();
	});

	it("promotes an admitted draft atomically and replays idempotently", () => {
		const { db, repo } = createRepo();
		const now = "2026-06-26T00:00:00.000Z";
		const request = admittedRequest("admitted-1", "Ship it");
		repo.createDraft({
			id: "550e8400-e29b-41d4-a716-446655440000",
			text: "Ship it",
			runtimeMode: "read-only",
			now,
		});

		const first = repo.promoteDraftWithAdmittedRequest({
			draftId: "550e8400-e29b-41d4-a716-446655440000",
			request,
			cwd: "/workspace",
			ids: promotionIds("a"),
			now,
		});
		const replay = repo.promoteDraftWithAdmittedRequest({
			draftId: "550e8400-e29b-41d4-a716-446655440000",
			request,
			cwd: "/workspace",
			ids: promotionIds("b"),
			now: "2026-06-26T00:00:01.000Z",
		});
		const count = db
			.prepare("SELECT COUNT(*) AS count FROM conversations")
			.get() as {
			count: number;
		};

		expect(first.idempotentReplay).toBe(false);
		expect(replay.idempotentReplay).toBe(true);
		expect(replay.conversationId).toBe(first.conversationId);
		expect(count.count).toBe(1);
		db.close();
	});

	it("rejects reused admitted request ids with different content", () => {
		const { db, repo } = createRepo();
		const now = "2026-06-26T00:00:00.000Z";
		repo.promoteDraftWithAdmittedRequest({
			draftId: "550e8400-e29b-41d4-a716-446655440000",
			request: admittedRequest("admitted-1", "Ship it"),
			cwd: "/workspace",
			ids: promotionIds("a"),
			now,
		});

		expect(() =>
			repo.promoteDraftWithAdmittedRequest({
				draftId: "550e8400-e29b-41d4-a716-446655440000",
				request: admittedRequest("admitted-1", "Different"),
				cwd: "/workspace",
				ids: promotionIds("b"),
				now: "2026-06-26T00:00:01.000Z",
			}),
		).toThrow("different content");
		db.close();
	});

	it("expires pending approval answer drafts on restart because approvals are not restart-recoverable", () => {
		const { db, repo } = createRepo();
		const now = "2026-06-26T00:00:00.000Z";
		const conversationId = "550e8400-e29b-41d4-a716-446655440020";
		insertQueuedConversation(db, conversationId);
		const target = parseComposerTarget({
			kind: "conversation",
			id: conversationId,
		});
		repo.upsertComposerDraft({
			target,
			now,
			envelope: {
				version: 2,
				target,
				input: {
					text: "keep normal draft",
					mode: "ask",
					model: "gpt-5.4-mini",
					runtimeMode: "read-only",
					contextItems: [],
					attachments: [],
					selection: { start: 17, end: 17 },
					payload: {},
				},
				pendingRequestAnswerDrafts: {
					"request-1": { "question-1": "typed answer" },
				},
				updatedAt: now,
			},
		});

		repo.recoverInterruptedState("2026-06-26T00:01:00.000Z");

		const restored = repo.loadComposerDraft(target);
		expect(restored?.text).toBe("keep normal draft");
		expect(
			(
				restored?.payload as {
					pendingRequestAnswerDrafts?: unknown;
				}
			).pendingRequestAnswerDrafts,
		).toEqual({});
		expect(restored?.lastError).toContain(
			"draft_approval_answers_expired_on_restart",
		);
		db.close();
	});

	it("cleans old drafts with FK-safe retention rules", () => {
		const { db, repo } = createRepo();
		const old = "2026-05-01T00:00:00.000Z";
		const now = "2026-06-26T00:00:00.000Z";
		const discarded = parseComposerTarget({
			kind: "draft",
			id: "550e8400-e29b-41d4-a716-446655440010",
		});
		const referenced = parseComposerTarget({
			kind: "draft",
			id: "550e8400-e29b-41d4-a716-446655440011",
		});
		repo.upsertComposerDraft({
			target: discarded,
			now: old,
			envelope: emptyEnvelope(discarded, "delete me", old),
		});
		repo.upsertComposerDraft({
			target: referenced,
			now: old,
			envelope: emptyEnvelope(referenced, "keep referenced", old),
		});
		repo.clearComposerDraft({ target: discarded, now: old });
		repo.clearComposerDraft({ target: referenced, now: old });
		insertQueuedConversation(db, "conversation-retention");
		repo.recordAdmittedRequest({
			request: admittedRequest("admitted-retention", "Audit me"),
			conversationId: "conversation-retention",
			draftId: referenced.id,
			status: "admitted",
			now: old,
		});
		const promotedRequest = admittedRequest(
			"admitted-promoted",
			"Compact me",
		);
		repo.createDraft({
			id: "550e8400-e29b-41d4-a716-446655440012",
			text: "Compact me",
			runtimeMode: "read-only",
			now: old,
		});
		const promoted = repo.promoteDraftWithAdmittedRequest({
			draftId: "550e8400-e29b-41d4-a716-446655440012",
			request: promotedRequest,
			cwd: "/workspace",
			ids: promotionIds("retention-promoted"),
			now: old,
		});

		const result = repo.cleanupDraftRetention({
			discardedBefore: now,
			promotedBefore: now,
			now,
		});

		expect(result).toEqual({
			discardedDeleted: 1,
			promotedCompacted: 1,
		});
		expect(repo.loadComposerDraft(discarded)).toBeUndefined();
		expect(repo.loadComposerDraft(referenced)?.status).toBe("discarded");
		const compacted = repo.getDraft("550e8400-e29b-41d4-a716-446655440012");
		expect(compacted?.text).toBe("");
		expect(compacted?.promotedConversationId).toBe(promoted.conversationId);
		expect((compacted?.payload as { redacted?: boolean }).redacted).toBe(
			true,
		);
		const admitted = db
			.prepare(
				"SELECT draft_id AS draftId FROM admitted_requests WHERE id = ?",
			)
			.get("admitted-promoted") as { draftId: string };
		expect(admitted.draftId).toBe("550e8400-e29b-41d4-a716-446655440012");
		db.close();
	});
});

function turnRow(input: { status: "running" | "completed" }) {
	return {
		id: "turn-1",
		conversation_id: "conversation-1",
		provider_session_id: "provider-session-1",
		provider_turn_id: null,
		user_message_id: "message-user-1",
		assistant_message_id: "message-assistant-1",
		status: input.status,
		started_at: "2026-06-25T00:00:00.000Z",
		completed_at:
			input.status === "completed" ? "2026-06-25T00:00:01.000Z" : null,
	};
}

function createRepo() {
	const path = tempDbPath();
	const db = openConversationDatabase(path);
	return { db, repo: new ConversationRepository(db) };
}

function tempDbPath() {
	const dir = mkdtempSync(join(tmpdir(), "experimental-desktop-repo-"));
	tempDirs.push(dir);
	return join(dir, "conversations.sqlite");
}

function insertQueuedConversation(
	db: ConversationDatabase,
	conversationId: string,
) {
	const now = "2026-06-26T00:00:00.000Z";
	db.prepare(
		`INSERT INTO conversations
		(id, title, cwd, model, runtime_mode, status, created_at, updated_at, last_message_at)
		VALUES (@id, @title, @cwd, @model, @runtimeMode, 'idle', @now, @now, @now)`,
	).run({
		id: conversationId,
		title: "Queued conversation",
		cwd: "/workspace",
		model: null,
		runtimeMode: "read-only",
		now,
	});
}

function emptyEnvelope(
	target: ReturnType<typeof parseComposerTarget>,
	text: string,
	updatedAt: string,
) {
	return {
		version: 2 as const,
		target,
		input: {
			text,
			mode: "ask" as const,
			model: "gpt-5.4-mini",
			runtimeMode: "read-only" as const,
			contextItems: [],
			attachments: [],
			selection: { start: text.length, end: text.length },
			payload: {},
		},
		pendingRequestAnswerDrafts: {},
		updatedAt,
	};
}

function admittedRequest(
	id: string,
	prompt: string,
): ValidatedAdmittedComposerRequest {
	return {
		id,
		draftSnapshot: { text: prompt },
		requestParts: [{ type: "text", text: prompt }],
		providerInput: {
			provider: "codex",
			prompt,
			model: "gpt-5.4-mini",
			runtimeMode: "read-only",
			nativeInput: [],
		},
		admission: { mode: "ask" },
		compatibilityPayload: { text: prompt, mode: "ask" },
	};
}

function promotionIds(suffix: string) {
	return {
		conversationId: `conversation-${suffix}`,
		providerSessionId: `provider-session-${suffix}`,
		turnId: `turn-${suffix}`,
		userMessageId: `message-user-${suffix}`,
		assistantMessageId: `message-assistant-${suffix}`,
	};
}
