import { describe, expect, it } from "vitest";
import { buildComposerPayload } from "../../components/composer/composerPayload";
import type { ComposerDraftPersistInput } from "../../components/composer/core/composerDraftSync";
import { admitComposerRequest } from "../../components/composer/core/composerSendController";
import { createConversationClient } from "../conversationClient";

describe("conversationClient", () => {
	it("persists new and existing drafts through the transport boundary", async () => {
		const calls: string[] = [];
		const client = createConversationClient({
			...fakeTransport(),
			createDraft: async (input) => {
				calls.push(`create:${input?.text}:${input?.cwd}`);
				return draftRecord("draft-new");
			},
			updateDraft: async (draftId, input) => {
				calls.push(`update:${draftId}:${input.text}:${input.cwd}`);
				return draftRecord(draftId);
			},
		});

		await client.persistDraft({
			draft: draftInput("hello"),
			cwd: "/workspace",
		});
		await client.persistDraft({
			draftId: "draft-existing",
			draft: draftInput("again"),
			cwd: "/workspace",
		});

		expect(calls).toEqual([
			"create:hello:/workspace",
			"update:draft-existing:again:/workspace",
		]);
	});

	it("routes admitted sends to existing conversations or draft promotion", async () => {
		const calls: string[] = [];
		const client = createConversationClient({
			...fakeTransport(),
			sendConversationMessage: async (conversationId, input) => {
				calls.push(
					`send:${conversationId}:${input.text}:${input.model}:${input.runtimeMode}`,
				);
				return undefined;
			},
			promoteDraftAndSend: async (input) => {
				calls.push(
					`promote:${input.draftId}:${input.cwd}:${input.text}:${input.model}`,
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
		createdAt: "2026-06-24T00:00:00.000Z",
		updatedAt: "2026-06-24T00:00:00.000Z",
	};
}

function fakeTransport() {
	return {
		loadConversationDetail: async () => undefined,
		createDraft: async () => draftRecord("draft-1"),
		updateDraft: async (draftId: string) => draftRecord(draftId),
		promoteDraftAndSend: async () => undefined,
		sendConversationMessage: async () => undefined,
		interruptConversation: async () => ({ ok: true as const }),
		respondApproval: async () => ({ ok: true as const }),
	};
}
