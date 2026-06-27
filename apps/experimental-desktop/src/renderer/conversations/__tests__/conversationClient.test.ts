import { describe, expect, it } from "vitest";
import { buildComposerPayload } from "../../components/composer/composerPayload";
import type { ComposerDraftPersistInput } from "../../components/composer/core/composerDraftSync";
import type { AdmittedComposerRequest } from "../../components/composer/core/composerProviderTypes";
import { admitComposerRequest } from "../../components/composer/core/composerSendController";
import { createConversationClient } from "../conversationClient";

describe("conversationClient", () => {
	it("persists target-keyed composer drafts through the transport boundary", async () => {
		const calls: string[] = [];
		const client = createConversationClient({
			...fakeTransport(),
			upsertComposerDraft: async (input) => {
				calls.push(
					`upsert:${input.target.kind}:${input.target.id}:${input.envelope.input.text}:${input.cwd}`,
				);
				return draftRecord(input.target.id);
			},
		});

		await client.persistDraft({
			target: {
				kind: "draft",
				id: "550e8400-e29b-41d4-a716-446655440000",
			},
			draft: draftInput("hello"),
			cwd: "/workspace",
		});
		await client.persistDraft({
			target: {
				kind: "conversation",
				id: "550e8400-e29b-41d4-a716-446655440001",
			},
			draft: draftInput("again"),
			cwd: "/workspace",
		});

		expect(calls).toEqual([
			"upsert:draft:550e8400-e29b-41d4-a716-446655440000:hello:/workspace",
			"upsert:conversation:550e8400-e29b-41d4-a716-446655440001:again:/workspace",
		]);
	});

	it("routes admitted sends to existing conversations or draft promotion", async () => {
		const calls: string[] = [];
		const client = createConversationClient({
			...fakeTransport(),
			sendAdmittedMessage: async (conversationId, input) => {
				calls.push(
					`send:${conversationId}:${input.request.providerInput.prompt}:${input.request.providerInput.model}:${input.request.providerInput.runtimeMode}`,
				);
				return undefined;
			},
			promoteDraftAndSendAdmitted: async (input) => {
				calls.push(
					`promote:${input.draftId}:${input.cwd}:${input.request.providerInput.prompt}:${input.request.providerInput.model}`,
				);
				return undefined;
			},
		});
		const request = admittedRequest("Ship it");

		await client.sendAdmittedRequest({
			conversationId: "conversation-1",
			request,
		});
		await client.sendAdmittedRequest({
			draftId: "draft-1",
			cwd: "/workspace",
			request,
		});

		expect(calls).toEqual([
			"send:conversation-1:Ship it:gpt-5.4-mini:read-only",
			"promote:draft-1:/workspace:Ship it:gpt-5.4-mini",
		]);
	});

	it("rejects unsupported provider sends before transport", async () => {
		const calls: string[] = [];
		const client = createConversationClient({
			...fakeTransport(),
			sendAdmittedMessage: async () => {
				calls.push("send");
				return undefined;
			},
			promoteDraftAndSendAdmitted: async () => {
				calls.push("promote");
				return undefined;
			},
		});
		const request = {
			...admittedRequest("Ship it"),
			providerInput: { provider: "opencode" },
		} as unknown as AdmittedComposerRequest;

		await expect(
			client.sendAdmittedRequest({
				conversationId: "conversation-1",
				request,
			}),
		).rejects.toThrow("Unsupported provider: opencode");
		expect(calls).toEqual([]);
	});

	it("routes approval responses and interrupts through transport", async () => {
		const calls: string[] = [];
		const client = createConversationClient({
			...fakeTransport(),
			respondApproval: async (conversationId, requestId, response) => {
				calls.push(
					`respond:${conversationId}:${requestId}:${
						"decision" in response ? response.decision : "answers"
					}`,
				);
				return { ok: true };
			},
			interruptConversation: async (conversationId) => {
				calls.push(`interrupt:${conversationId}`);
				return { ok: true };
			},
		});

		await client.respondToApproval({
			conversationId: "conversation-1",
			requestId: "request-1",
			response: { decision: "accept" },
		});
		await client.interrupt({ conversationId: "conversation-1" });

		expect(calls).toEqual([
			"respond:conversation-1:request-1:accept",
			"interrupt:conversation-1",
		]);
	});

	it("routes queue admission, cancel, and execute through transport", async () => {
		const calls: string[] = [];
		const client = createConversationClient({
			...fakeTransport(),
			enqueueAdmittedMessage: async (conversationId, input) => {
				calls.push(
					`queue:${conversationId}:${input.request.providerInput.prompt}`,
				);
				return {
					id: "queue-1",
					conversationId,
					admittedRequestId: input.request.id,
					position: 0,
					status: "queued" as const,
					createdAt: "2026-06-24T00:00:00.000Z",
					updatedAt: "2026-06-24T00:00:00.000Z",
				};
			},
			updateConversationQueueItem: async (queueItemId, input) => {
				calls.push(`queue-update:${queueItemId}:${input.status}`);
				return undefined;
			},
			executeNextConversationQueueItem: async (conversationId) => {
				calls.push(`queue-execute:${conversationId}`);
				return { ok: true, executed: false };
			},
		});

		await client.enqueueAdmittedRequest({
			conversationId: "conversation-1",
			request: admittedRequest("Later"),
		});
		await client.cancelQueuedRequest({ queueItemId: "queue-1" });
		await client.executeNextQueuedRequest({
			conversationId: "conversation-1",
		});

		expect(calls).toEqual([
			"queue:conversation-1:Later",
			"queue-update:queue-1:canceled",
			"queue-execute:conversation-1",
		]);
	});
});

function admittedRequest(text: string) {
	const result = admitComposerRequest({
		payload: buildComposerPayload({
			mode: "ask",
			text,
			contextItems: [],
			attachments: [],
		}),
		model: "gpt-5.4-mini",
		runtimeMode: "workspace-write",
		createId: () => "admitted-1",
	});
	if (!result.ok) {
		throw new Error(result.reason);
	}
	return result.request;
}

function draftInput(text: string): ComposerDraftPersistInput {
	return {
		model: "gpt-5.4-mini",
		runtimeMode: "workspace-write",
		selection: { start: text.length, end: text.length },
		payload: buildComposerPayload({
			mode: "ask",
			text,
			contextItems: [],
			attachments: [],
		}),
	};
}

function draftRecord(id: string) {
	return {
		id,
		text: "",
		runtimeMode: "read-only" as const,
		attachments: [],
		payload: {},
		version: 1,
		mode: "ask" as const,
		status: "active" as const,
		createdAt: "2026-06-24T00:00:00.000Z",
		updatedAt: "2026-06-24T00:00:00.000Z",
	};
}

function fakeTransport() {
	return {
		loadConversationDetail: async () => undefined,
		createDraft: async () => draftRecord("draft-1"),
		updateDraft: async (draftId: string) => draftRecord(draftId),
		loadComposerDraft: async () => undefined,
		upsertComposerDraft: async () => draftRecord("draft-1"),
		clearComposerDraft: async () => ({
			ok: true as const,
			hardDeleted: true,
		}),
		promoteDraftAndSend: async () => undefined,
		promoteDraftAndSendAdmitted: async () => undefined,
		sendConversationMessage: async () => undefined,
		sendAdmittedMessage: async () => undefined,
		enqueueAdmittedMessage: async () => ({
			id: "queue-1",
			conversationId: "conversation-1",
			admittedRequestId: "admitted-1",
			position: 0,
			status: "queued" as const,
			createdAt: "2026-06-24T00:00:00.000Z",
			updatedAt: "2026-06-24T00:00:00.000Z",
		}),
		updateConversationQueueItem: async () => undefined,
		listConversationQueueItems: async () => [],
		executeNextConversationQueueItem: async () => ({
			ok: true as const,
			executed: false as const,
		}),
		interruptConversation: async () => ({ ok: true as const }),
		respondApproval: async () => ({ ok: true as const }),
	};
}
