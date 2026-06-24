// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	ConversationDetail,
	ConversationEvent,
	RespondSessionRequestInput,
} from "../../../preload/types";
import { buildComposerPayload } from "../../components/composer/composerPayload";
import type { ComposerDraftPersistInput } from "../../components/composer/core/composerDraftSync";
import type { AdmittedComposerRequest } from "../../components/composer/core/composerProviderTypes";
import { admitComposerRequest } from "../../components/composer/core/composerSendController";
import type { ConversationEventStore } from "../conversationEventStore";
import {
	useConversationSessionController,
	type ConversationSessionControllerDeps,
} from "../useConversationSessionController";

describe("useConversationSessionController", () => {
	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
			true;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("createNewSession clears ids, projection, and event log", async () => {
		const harness = renderController();
		await act(async () => {
			await harness.current.openLoadedConversation(
				conversationDetail({
					status: "waiting_approval",
					messages: [messageRecord("message-1", "user", "hello")],
					pendingApprovals: [approvalRecord("request-1")],
				}),
			);
		});
		await act(async () => {
			harness.emit(messageCreatedEvent("event-1", "event log row"));
		});

		expect(harness.current.conversationId).toBe("conversation-1");
		expect(harness.current.transcript.length).toBeGreaterThan(0);
		expect(harness.current.eventLog.length).toBeGreaterThan(0);

		await act(async () => {
			await harness.current.createNewSession();
		});

		expect(harness.current.conversationId).toBeUndefined();
		expect(harness.current.draftId).toBeUndefined();
		expect(harness.current.threadId).toBeUndefined();
		expect(harness.current.transcript).toEqual([]);
		expect(harness.current.pendingRequests).toEqual([]);
		expect(harness.current.eventLog).toEqual([]);
		expect(harness.current.status).toBe("Draft ready");
		harness.unmount();
	});

	it("openLoadedConversation hydrates projection and subscribes", async () => {
		const harness = renderController();

		await act(async () => {
			await harness.current.openLoadedConversation(
				conversationDetail({
					messages: [messageRecord("message-1", "user", "hello")],
				}),
			);
		});

		expect(harness.subscribeCalls).toEqual(["conversation-1"]);
		expect(harness.current.conversationId).toBe("conversation-1");
		expect(harness.current.threadId).toBe("thread-1");
		expect(harness.current.status).toBe("idle · Read Only");
		expect(harness.current.transcript).toEqual([
			expect.objectContaining({ id: "message-1", type: "user" }),
		]);
		harness.unmount();
	});

	it("sendAdmittedRequest promotes draft and refreshes history", async () => {
		const sendAdmittedRequest = vi
			.fn()
			.mockResolvedValue(
				conversationDetail({ id: "conversation-promoted" }),
			);
		const refreshConversations = vi.fn().mockResolvedValue(undefined);
		const harness = renderController({
			client: { sendAdmittedRequest },
			refreshConversations,
		});

		await act(async () => {
			await harness.current.persistDraft(draftInput("draft text"));
		});
		await act(async () => {
			const sent = await harness.current.sendAdmittedRequest(
				admittedRequest("Ship it"),
			);
			expect(sent).toBe(true);
		});

		expect(sendAdmittedRequest).toHaveBeenCalledWith({
			draftId: "draft-1",
			cwd: "/workspace",
			request: expect.objectContaining({
				providerInput: expect.objectContaining({ prompt: "Ship it" }),
			}),
		});
		expect(refreshConversations).toHaveBeenCalledTimes(1);
		expect(harness.subscribeCalls).toEqual(["conversation-promoted"]);
		expect(harness.current.conversationId).toBe("conversation-promoted");
		expect(harness.current.status).toBe("Running...");
		harness.unmount();
	});

	it("respondToRequest applies default answers for user-input request", async () => {
		const respondToApproval = vi.fn().mockResolvedValue({ ok: true });
		const harness = renderController({ client: { respondToApproval } });

		await act(async () => {
			await harness.current.openLoadedConversation(
				conversationDetail({
					status: "waiting_approval",
					pendingApprovals: [
						approvalRecord("request-1", {
							kind: "user-input",
							request: {
								questions: [
									{
										id: "choice",
										options: [{ label: "Yes" }],
									},
								],
							},
						}),
					],
				}),
			);
		});
		await act(async () => {
			await harness.current.respondToRequest("request-1", "accept");
		});

		expect(respondToApproval).toHaveBeenCalledWith({
			conversationId: "conversation-1",
			requestId: "request-1",
			response: { answers: { choice: ["Yes"] } },
		});
		expect(harness.current.pendingRequests).toEqual([]);
		expect(harness.current.status).toBe("Running...");
		harness.unmount();
	});

	it("interrupt clears pending and running state", async () => {
		const interrupt = vi.fn().mockResolvedValue({ ok: true });
		const refreshConversations = vi.fn().mockResolvedValue(undefined);
		const harness = renderController({
			client: { interrupt },
			refreshConversations,
		});

		await act(async () => {
			await harness.current.openLoadedConversation(
				conversationDetail({
					status: "waiting_approval",
					pendingApprovals: [approvalRecord("request-1")],
				}),
			);
		});
		await act(async () => {
			await harness.current.interruptConversation();
		});

		expect(interrupt).toHaveBeenCalledWith({
			conversationId: "conversation-1",
		});
		expect(refreshConversations).toHaveBeenCalledTimes(1);
		expect(harness.current.pendingRequests).toEqual([]);
		expect(harness.current.isTurnActive).toBe(false);
		expect(harness.current.isTurnRunning).toBe(false);
		expect(harness.current.status).toBe("Interrupted");
		harness.unmount();
	});
});

function renderController(input?: {
	client?: Partial<ConversationSessionControllerDeps["client"]>;
	refreshConversations?: () => Promise<void>;
}) {
	let current: ReturnType<typeof useConversationSessionController>;
	let listener: ((event: ConversationEvent) => void) | undefined;
	const subscribeCalls: string[] = [];
	const rootElement = document.createElement("div");
	document.body.append(rootElement);
	const root = createRoot(rootElement);
	const refreshConversations =
		input?.refreshConversations ?? vi.fn().mockResolvedValue(undefined);
	const client = {
		loadConversationDetail: vi.fn().mockResolvedValue(undefined),
		persistDraft: vi.fn().mockResolvedValue(draftRecord("draft-1")),
		sendAdmittedRequest: vi.fn().mockResolvedValue(undefined),
		respondToApproval: vi.fn().mockResolvedValue({ ok: true }),
		interrupt: vi.fn().mockResolvedValue({ ok: true }),
		...input?.client,
	};
	const deps = {
		client,
		createEventStore: () =>
			({
				subscribe: async (
					conversationId: string,
					nextListener: (event: ConversationEvent) => void,
				) => {
					subscribeCalls.push(conversationId);
					listener = nextListener;
				},
				clear: vi.fn(),
			}) satisfies ConversationEventStore,
		useHistoryStore: () => ({
			conversations: [],
			status: "ready",
			error: undefined,
			refreshConversations,
		}),
	} satisfies ConversationSessionControllerDeps;

	function Harness() {
		current = useConversationSessionController({
			model: "gpt-5.4-mini",
			runtimeMode: "read-only",
			selectedFolderPath: "/workspace",
			deps,
		});
		return null;
	}

	act(() => {
		root.render(<Harness />);
	});

	return {
		get current() {
			return current;
		},
		subscribeCalls,
		emit(event: ConversationEvent) {
			listener?.(event);
		},
		unmount() {
			act(() => {
				root.unmount();
			});
			rootElement.remove();
		},
	};
}

function conversationDetail(
	overrides: Partial<ConversationDetail> = {},
): ConversationDetail {
	return {
		id: "conversation-1",
		title: "Conversation",
		cwd: "/workspace",
		model: "gpt-5.4-mini",
		runtimeMode: "read-only",
		status: "idle",
		createdAt: "2026-06-24T00:00:00.000Z",
		updatedAt: "2026-06-24T00:00:00.000Z",
		providerThreadId: "thread-1",
		messages: [],
		pendingApprovals: [],
		...overrides,
	};
}

function messageRecord(
	id: string,
	role: "user" | "assistant" | "system",
	text: string,
) {
	return {
		id,
		conversationId: "conversation-1",
		ordinal: 0,
		role,
		status: "completed" as const,
		text,
		createdAt: "2026-06-24T00:00:00.000Z",
		updatedAt: "2026-06-24T00:00:00.000Z",
	};
}

function approvalRecord(
	requestId: string,
	overrides: { kind?: "command" | "user-input"; request?: unknown } = {},
) {
	return {
		id: `approval-${requestId}`,
		conversationId: "conversation-1",
		turnId: "turn-1",
		providerRequestId: requestId,
		providerItemId: "item-1",
		kind: overrides.kind ?? "command",
		status: "pending" as const,
		request: overrides.request ?? {},
		createdAt: "2026-06-24T00:00:01.000Z",
	};
}

function messageCreatedEvent(id: string, text: string): ConversationEvent {
	return {
		id,
		type: "message.created",
		time: "2026-06-24T00:00:02.000Z",
		data: { text, messageId: id },
	};
}

function admittedRequest(text: string): AdmittedComposerRequest {
	const result = admitComposerRequest({
		payload: buildComposerPayload({
			mode: "ask",
			text,
			contextItems: [],
			attachments: [],
		}),
		model: "gpt-5.4-mini",
		runtimeMode: "read-only",
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
		runtimeMode: "read-only",
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
