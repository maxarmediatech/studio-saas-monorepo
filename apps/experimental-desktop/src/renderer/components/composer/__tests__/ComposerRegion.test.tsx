// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	DraftRecord,
	PersistedQueueItem,
	RespondSessionRequestInput,
} from "../../../../preload/types";
import type { ComposerQueuePanel } from "../ComposerQueuePanel";
import { ComposerRegion, type ComposerRegionSession } from "../ComposerRegion";
import type { SessionComposer } from "../SessionComposer";

type SessionComposerProps = Parameters<typeof SessionComposer>[0];
type ComposerQueuePanelProps = Parameters<typeof ComposerQueuePanel>[0];

let latestComposerProps: SessionComposerProps | undefined;
let latestQueuePanelProps: ComposerQueuePanelProps | undefined;

vi.mock("../SessionComposer", () => ({
	SessionComposer: (props: SessionComposerProps) => {
		latestComposerProps = props;
		return <>{props.queuePanel}</>;
	},
}));

vi.mock("../ComposerQueuePanel", () => ({
	ComposerQueuePanel: (props: ComposerQueuePanelProps) => {
		latestQueuePanelProps = props;
		return null;
	},
}));

describe("ComposerRegion", () => {
	beforeEach(() => {
		(
			globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		latestComposerProps = undefined;
		latestQueuePanelProps = undefined;
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("resets route draft state and creates a new session when draft route changes", async () => {
		const createNewSession = vi.fn().mockResolvedValue(undefined);
		const harness = renderRegion({
			session: sessionStub({ createNewSession }),
			routeDraftId: "draft-1",
			draftScopeId: "draft-1",
		});

		expect(createNewSession).toHaveBeenCalledTimes(1);
		const firstResetSignal = latestComposerProps?.resetSignal;

		await act(async () => {
			harness.rerender({
				session: sessionStub({ createNewSession }),
				routeDraftId: "draft-2",
				draftScopeId: "draft-2",
			});
		});

		expect(createNewSession).toHaveBeenCalledTimes(2);
		expect(latestComposerProps?.value).toBe("");
		expect(latestComposerProps?.resetSignal).toBe(
			(firstResetSignal ?? 0) + 1,
		);
		harness.unmount();
	});

	it("persists the live draft through ComposerDraftSync", async () => {
		const persistDraft = vi.fn().mockResolvedValue(undefined);
		const harness = renderRegion({
			session: sessionStub({ persistDraft }),
		});

		await act(async () => {
			latestComposerProps?.onChange("remember this");
		});
		await act(async () => {
			vi.advanceTimersByTime(350);
		});

		expect(persistDraft).toHaveBeenCalledWith(
			expect.objectContaining({
				target: { kind: "draft", id: "draft-db-1" },
				draft: expect.objectContaining({
					model: "gpt-5.4-mini",
					runtimeMode: "read-only",
					payload: expect.objectContaining({ text: "remember this" }),
				}),
			}),
		);
		harness.unmount();
	});

	it("does not overwrite user input when draft hydration resolves late", async () => {
		let resolveDraft:
			| ((value: DraftRecord | undefined) => void)
			| undefined;
		const loadComposerDraft = vi.fn(
			() =>
				new Promise<DraftRecord | undefined>((resolve) => {
					resolveDraft = resolve;
				}),
		);
		const harness = renderRegion({
			session: sessionStub({ loadComposerDraft }),
			routeDraftId: "550e8400-e29b-41d4-a716-446655440010",
			draftScopeId: "550e8400-e29b-41d4-a716-446655440010",
		});

		await act(async () => {
			latestComposerProps?.onChange("Fresh user input");
		});
		await act(async () => {
			resolveDraft?.(
				draftRecord({
					id: "550e8400-e29b-41d4-a716-446655440010",
					payload: {
						version: 2,
						target: {
							kind: "draft",
							id: "550e8400-e29b-41d4-a716-446655440010",
						},
						input: {
							text: "Stored stale text",
							mode: "ask",
							model: "gpt-5.4-mini",
							runtimeMode: "read-only",
							contextItems: [],
							attachments: [],
							payload: {},
						},
						pendingRequestAnswerDrafts: {},
						updatedAt: "2026-06-24T00:00:00.000Z",
					},
				}),
			);
			await Promise.resolve();
		});

		expect(latestComposerProps?.value).toBe("Fresh user input");
		harness.unmount();
	});

	it("hydrates a route draft after resetting previous draft text", async () => {
		const routeDraftId = "550e8400-e29b-41d4-a716-446655440013";
		const loadComposerDraft = vi.fn((target) =>
			Promise.resolve(
				target.kind === "draft" && target.id === routeDraftId
					? draftRecord({
							id: routeDraftId,
							payload: {
								version: 2,
								target: { kind: "draft", id: routeDraftId },
								input: {
									text: "Restored route draft",
									mode: "ask",
									model: "gpt-5.4-mini",
									runtimeMode: "read-only",
									contextItems: [],
									attachments: [],
									selection: { start: 20, end: 20 },
									payload: {},
								},
								pendingRequestAnswerDrafts: {},
								updatedAt: "2026-06-24T00:00:00.000Z",
							},
						})
					: undefined,
			),
		);
		const harness = renderRegion({
			session: sessionStub({ loadComposerDraft }),
		});

		await act(async () => {
			latestComposerProps?.onChange("Old unsent text");
		});
		await act(async () => {
			harness.rerender({
				routeDraftId,
				draftScopeId: routeDraftId,
				session: sessionStub({ loadComposerDraft }),
			});
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(latestComposerProps?.value).toBe("Restored route draft");
		harness.unmount();
	});

	it("does not overwrite pending answer drafts when draft hydration resolves late", async () => {
		let resolveDraft:
			| ((value: DraftRecord | undefined) => void)
			| undefined;
		const loadComposerDraft = vi.fn(
			() =>
				new Promise<DraftRecord | undefined>((resolve) => {
					resolveDraft = resolve;
				}),
		);
		const harness = renderRegion({
			session: sessionStub({
				conversationId: "550e8400-e29b-41d4-a716-446655440020",
				draftId: undefined,
				loadComposerDraft,
			}),
		});

		await act(async () => {
			latestComposerProps?.onPendingRequestAnswerDraftChange?.(
				"request-1",
				"question-1",
				"Fresh answer",
			);
		});
		await act(async () => {
			resolveDraft?.(
				draftRecord({
					id: "composer:conversation:550e8400-e29b-41d4-a716-446655440020",
					payload: {
						version: 2,
						target: {
							kind: "conversation",
							id: "550e8400-e29b-41d4-a716-446655440020",
						},
						input: {
							text: "",
							mode: "ask",
							model: "gpt-5.4-mini",
							runtimeMode: "read-only",
							contextItems: [],
							attachments: [],
							payload: {},
						},
						pendingRequestAnswerDrafts: {
							"request-1": { "question-1": "Stored answer" },
						},
						updatedAt: "2026-06-24T00:00:00.000Z",
					},
				}),
			);
			await Promise.resolve();
		});

		expect(
			latestComposerProps?.pendingRequestAnswerDrafts?.["request-1"]?.[
				"question-1"
			],
		).toBe("Fresh answer");
		harness.unmount();
	});

	it("hydrates pending answer drafts after switching conversation targets", async () => {
		const conversationA = "550e8400-e29b-41d4-a716-446655440021";
		const conversationB = "550e8400-e29b-41d4-a716-446655440022";
		const loadComposerDraftA = vi.fn(
			() => new Promise<DraftRecord | undefined>(() => undefined),
		);
		const loadComposerDraftB = vi.fn().mockResolvedValue(
			draftRecord({
				id: `composer:conversation:${conversationB}`,
				payload: {
					version: 2,
					target: {
						kind: "conversation",
						id: conversationB,
					},
					input: {
						text: "",
						mode: "ask",
						model: "gpt-5.4-mini",
						runtimeMode: "read-only",
						contextItems: [],
						attachments: [],
						payload: {},
					},
					pendingRequestAnswerDrafts: {
						"request-b": { "question-b": "Stored B answer" },
					},
					updatedAt: "2026-06-24T00:00:00.000Z",
				},
			}),
		);
		const harness = renderRegion({
			session: sessionStub({
				conversationId: conversationA,
				draftId: undefined,
				loadComposerDraft: loadComposerDraftA,
			}),
		});

		await act(async () => {
			latestComposerProps?.onPendingRequestAnswerDraftChange?.(
				"request-a",
				"question-a",
				"Unsaved A answer",
			);
		});
		await act(async () => {
			harness.rerender({
				session: sessionStub({
					conversationId: conversationB,
					draftId: undefined,
					loadComposerDraft: loadComposerDraftB,
				}),
			});
			await Promise.resolve();
		});

		await vi.waitFor(() => {
			expect(
				latestComposerProps?.pendingRequestAnswerDrafts?.[
					"request-b"
				]?.["question-b"],
			).toBe("Stored B answer");
		});
		expect(
			latestComposerProps?.pendingRequestAnswerDrafts?.["request-a"],
		).toBeUndefined();
		harness.unmount();
	});

	it("admits and sends current payload, then clears on success", async () => {
		const sendAdmittedRequest = vi.fn().mockResolvedValue(true);
		const harness = renderRegion({
			session: sessionStub({ sendAdmittedRequest }),
		});

		await act(async () => {
			latestComposerProps?.onChange("Ship it");
		});
		await act(async () => {
			const sent = await latestComposerProps?.onSend();
			expect(sent).toBe(true);
		});

		expect(sendAdmittedRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				draftSnapshot: expect.objectContaining({
					text: "Ship it",
					model: "gpt-5.4-mini",
					runtimeMode: "read-only",
				}),
				providerInput: expect.objectContaining({ prompt: "Ship it" }),
			}),
			{ target: { kind: "draft", id: "draft-db-1" } },
		);
		expect(latestComposerProps?.value).toBe("");
		expect(latestComposerProps?.mode).toBe("ask");
		harness.unmount();
	});

	it("uses route draft target even while the previous conversation session is still present", async () => {
		const sendAdmittedRequest = vi.fn().mockResolvedValue(true);
		const harness = renderRegion({
			routeDraftId: "550e8400-e29b-41d4-a716-446655440011",
			session: sessionStub({
				conversationId: "conversation-previous",
				draftId: "draft-db-1",
				sendAdmittedRequest,
			}),
		});

		await vi.waitFor(() => {
			expect(document.body.textContent).toContain("No saved draft found");
		});
		await act(async () => {
			latestComposerProps?.onChange("Send from route draft");
		});
		await act(async () => {
			const sent = await latestComposerProps?.onSend();
			expect(sent).toBe(true);
		});

		expect(sendAdmittedRequest).toHaveBeenCalledWith(expect.anything(), {
			target: {
				kind: "draft",
				id: "550e8400-e29b-41d4-a716-446655440011",
			},
		});
		harness.unmount();
	});

	it("does not clear newer text typed after a send starts", async () => {
		let resolveSend: ((value: boolean) => void) | undefined;
		const sendAdmittedRequest = vi.fn(
			() =>
				new Promise<boolean>((resolve) => {
					resolveSend = resolve;
				}),
		);
		const harness = renderRegion({
			session: sessionStub({ sendAdmittedRequest }),
		});

		await act(async () => {
			latestComposerProps?.onChange("Submitted");
		});
		let sendPromise: Promise<unknown> | undefined;
		await act(async () => {
			sendPromise = latestComposerProps?.onSend();
			await Promise.resolve();
		});
		await act(async () => {
			latestComposerProps?.onChange("New draft");
		});
		await act(async () => {
			resolveSend?.(true);
			await sendPromise;
		});

		expect(latestComposerProps?.value).toBe("New draft");
		harness.unmount();
	});

	it("preserves pending answer drafts when normal conversation input clears", async () => {
		const persistDraft = vi.fn().mockResolvedValue(undefined);
		const clearComposerDraft = vi.fn().mockResolvedValue(undefined);
		const sendAdmittedRequest = vi.fn().mockResolvedValue(true);
		const harness = renderRegion({
			session: sessionStub({
				conversationId: "550e8400-e29b-41d4-a716-446655440001",
				draftId: undefined,
				persistDraft,
				clearComposerDraft,
				sendAdmittedRequest,
			}),
		});

		await act(async () => {
			latestComposerProps?.onPendingRequestAnswerDraftChange?.(
				"request-1",
				"question-1",
				"answer me",
			);
			latestComposerProps?.onChange("Follow up");
		});
		await act(async () => {
			const sent = await latestComposerProps?.onSend();
			expect(sent).toBe(true);
		});

		expect(clearComposerDraft).not.toHaveBeenCalled();
		expect(persistDraft).toHaveBeenLastCalledWith(
			expect.objectContaining({
				target: {
					kind: "conversation",
					id: "550e8400-e29b-41d4-a716-446655440001",
				},
				draft: expect.objectContaining({
					payload: expect.objectContaining({ text: "" }),
					pendingRequestAnswerDrafts: {
						"request-1": { "question-1": "answer me" },
					},
				}),
			}),
		);
		expect(latestComposerProps?.value).toBe("");
		expect(
			latestComposerProps?.pendingRequestAnswerDrafts?.["request-1"]?.[
				"question-1"
			],
		).toBe("answer me");
		harness.unmount();
	});

	it("preserves draft state when send fails", async () => {
		const sendAdmittedRequest = vi.fn().mockResolvedValue(false);
		const harness = renderRegion({
			session: sessionStub({ sendAdmittedRequest }),
		});

		await act(async () => {
			latestComposerProps?.onChange("Keep me");
		});
		await act(async () => {
			const sent = await latestComposerProps?.onSend();
			expect(sent).toBe(false);
		});

		expect(latestComposerProps?.value).toBe("Keep me");
		harness.unmount();
	});

	it("queues admitted requests while an existing conversation is running", async () => {
		const sendAdmittedRequest = vi.fn().mockResolvedValue(true);
		const enqueueAdmittedRequest = vi.fn().mockResolvedValue({
			id: "queue-1",
			conversationId: "conversation-1",
			admittedRequestId: "admitted-1",
			position: 0,
			status: "queued",
			createdAt: "2026-06-24T00:00:00.000Z",
			updatedAt: "2026-06-24T00:00:00.000Z",
		});
		const harness = renderRegion({
			session: sessionStub({
				conversationId: "conversation-1",
				isTurnRunning: true,
				isTurnActive: true,
				sendAdmittedRequest,
				enqueueAdmittedRequest,
			}),
		});

		expect(latestComposerProps?.disabled).toBe(false);
		expect(latestComposerProps?.queueActive).toBe(true);
		await act(async () => {
			latestComposerProps?.onChange("Queue me");
		});
		await act(async () => {
			const queued = await latestComposerProps?.onSend();
			expect(queued).toBe(true);
		});

		expect(sendAdmittedRequest).not.toHaveBeenCalled();
		expect(enqueueAdmittedRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				providerInput: expect.objectContaining({ prompt: "Queue me" }),
			}),
		);
		expect(latestComposerProps?.value).toBe("");
		harness.unmount();
	});

	it("marks queued item failed when execute-next does not start execution", async () => {
		const executeNextQueuedRequest = vi
			.fn()
			.mockResolvedValue({ ok: false, executed: false });
		const harness = renderRegion({
			session: sessionStub({
				conversationId: "conversation-1",
				isTurnRunning: true,
				isTurnActive: true,
				enqueueAdmittedRequest: vi.fn().mockResolvedValue({
					id: "queue-1",
					conversationId: "conversation-1",
					admittedRequestId: "admitted-1",
					position: 0,
					status: "queued",
					createdAt: "2026-06-24T00:00:00.000Z",
					updatedAt: "2026-06-24T00:00:00.000Z",
				}),
				executeNextQueuedRequest,
			}),
		});

		await act(async () => {
			latestComposerProps?.onChange("Queue me");
		});
		await act(async () => {
			await latestComposerProps?.onSend();
		});
		await vi.waitFor(() => {
			expect(latestQueuePanelProps?.items[0]?.status).toBe("queued");
		});
		await act(async () => {
			harness.rerender({
				session: sessionStub({
					conversationId: "conversation-1",
					isTurnRunning: false,
					isTurnActive: false,
					executeNextQueuedRequest,
				}),
			});
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(executeNextQueuedRequest).toHaveBeenCalledTimes(1);
		await vi.waitFor(() => {
			expect(latestQueuePanelProps?.items[0]?.status).toBe("failed");
			expect(latestQueuePanelProps?.items[0]?.error).toBe(
				"Queue execution did not start",
			);
		});
		harness.unmount();
	});

	it("does not auto-execute while the queue is paused", async () => {
		const executeNextQueuedRequest = vi
			.fn()
			.mockResolvedValue({ ok: true, executed: true });
		const harness = renderRegion({
			session: sessionStub({
				conversationId: "conversation-1",
				isTurnRunning: true,
				isTurnActive: true,
				enqueueAdmittedRequest: vi.fn().mockResolvedValue({
					id: "queue-1",
					conversationId: "conversation-1",
					admittedRequestId: "admitted-1",
					position: 0,
					status: "queued",
					createdAt: "2026-06-24T00:00:00.000Z",
					updatedAt: "2026-06-24T00:00:00.000Z",
				}),
				executeNextQueuedRequest,
			}),
		});

		await act(async () => {
			latestComposerProps?.onChange("Queue me");
		});
		await act(async () => {
			await latestComposerProps?.onSend();
		});
		await vi.waitFor(() => {
			expect(latestQueuePanelProps?.items[0]?.status).toBe("queued");
		});
		await act(async () => {
			latestQueuePanelProps?.onPause();
			await Promise.resolve();
		});
		await vi.waitFor(() => {
			expect(latestQueuePanelProps?.isPaused).toBe(true);
		});
		await act(async () => {
			harness.rerender({
				session: sessionStub({
					conversationId: "conversation-1",
					isTurnRunning: false,
					isTurnActive: false,
					executeNextQueuedRequest,
				}),
			});
		});

		expect(executeNextQueuedRequest).not.toHaveBeenCalled();
		expect(latestQueuePanelProps?.items[0]?.status).toBe("queued");
		expect(latestQueuePanelProps?.isPaused).toBe(true);
		harness.unmount();
	});

	it("does not start a second queued request while one is executing", async () => {
		let resolveExecute: ((value: unknown) => void) | undefined;
		const executeNextQueuedRequest = vi.fn(
			() =>
				new Promise((resolve) => {
					resolveExecute = resolve;
				}),
		);
		const harness = renderRegion({
			session: sessionStub({
				conversationId: "conversation-1",
				listQueuedRequests: vi
					.fn()
					.mockResolvedValue([
						persistedQueueItem("queue-1", "First"),
						persistedQueueItem("queue-2", "Second"),
					]),
				executeNextQueuedRequest,
			}),
		});

		await vi.waitFor(() => {
			expect(executeNextQueuedRequest).toHaveBeenCalledTimes(1);
			expect(latestQueuePanelProps?.items[0]?.status).toBe("running");
			expect(latestQueuePanelProps?.items[1]?.status).toBe("queued");
		});
		await act(async () => {
			harness.rerender({
				session: sessionStub({
					conversationId: "conversation-1",
					executeNextQueuedRequest,
				}),
			});
			await Promise.resolve();
		});

		expect(executeNextQueuedRequest).toHaveBeenCalledTimes(1);
		await act(async () => {
			resolveExecute?.({ ok: true, executed: true });
			await Promise.resolve();
		});
		harness.unmount();
	});

	it("keeps hydrated running queue items running", async () => {
		const harness = renderRegion({
			session: sessionStub({
				conversationId: "conversation-1",
				listQueuedRequests: vi.fn().mockResolvedValue([
					{
						id: "queue-running",
						conversationId: "conversation-1",
						admittedRequestId: "admitted-1",
						position: 0,
						status: "running",
						request: {
							id: "request-1",
							draftSnapshot: {},
							requestParts: [],
							providerInput: { provider: "codex", prompt: "Run" },
							admission: {},
						},
						createdAt: "2026-06-24T00:00:00.000Z",
						updatedAt: "2026-06-24T00:00:00.000Z",
					},
				]),
			}),
		});

		await vi.waitFor(() => {
			expect(latestQueuePanelProps?.items[0]?.status).toBe("running");
			expect(latestQueuePanelProps?.items[0]?.error).toBeUndefined();
		});
		harness.unmount();
	});

	it("shows draft restore warnings returned from main", async () => {
		const harness = renderRegion({
			routeDraftId: "550e8400-e29b-41d4-a716-446655440012",
			draftScopeId: "550e8400-e29b-41d4-a716-446655440012",
			session: sessionStub({
				loadComposerDraft: vi.fn().mockResolvedValue(
					draftRecord({
						id: "550e8400-e29b-41d4-a716-446655440012",
						warnings: ["draft_parse_rebuilt_legacy_payload"],
						payload: {
							version: 2,
							target: {
								kind: "draft",
								id: "550e8400-e29b-41d4-a716-446655440012",
							},
							input: {
								text: "Restored",
								mode: "ask",
								model: "gpt-5.4-mini",
								runtimeMode: "read-only",
								contextItems: [],
								attachments: [],
								payload: {},
							},
							pendingRequestAnswerDrafts: {},
							updatedAt: "2026-06-24T00:00:00.000Z",
						},
					}),
				),
			}),
		});

		await vi.waitFor(() => {
			expect(document.body.textContent).toContain(
				"Draft restored with warnings: draft_parse_rebuilt_legacy_payload",
			);
		});
		harness.unmount();
	});

	it("marks draft send start and clears the marker on failed draft sends", async () => {
		const onDraftSendStarted = vi.fn();
		const onDraftSendFailed = vi.fn();
		const harness = renderRegion({
			routeDraftId: "draft-route-1",
			session: sessionStub({
				createNewSession: vi.fn().mockResolvedValue(undefined),
				sendAdmittedRequest: vi.fn().mockResolvedValue(false),
			}),
			onDraftSendStarted,
			onDraftSendFailed,
		});

		await act(async () => {
			latestComposerProps?.onChange("Try it");
		});
		await act(async () => {
			const sent = await latestComposerProps?.onSend();
			expect(sent).toBe(false);
		});

		expect(onDraftSendStarted).toHaveBeenCalledWith("draft-route-1");
		expect(onDraftSendFailed).toHaveBeenCalledWith("draft-route-1");
		harness.unmount();
	});
});

function renderRegion(input?: Partial<Parameters<typeof ComposerRegion>[0]>) {
	const rootElement = document.createElement("div");
	document.body.append(rootElement);
	const root = createRoot(rootElement);

	function props(
		overrides?: Partial<Parameters<typeof ComposerRegion>[0]>,
	): Parameters<typeof ComposerRegion>[0] {
		return {
			session: sessionStub(),
			model: "gpt-5.4-mini",
			runtimeMode: "read-only",
			runtimeOptions: [{ value: "read-only", label: "Read Only" }],
			draftScopeId: "scope-1",
			onModelChange: vi.fn(),
			onRuntimeModeChange: vi.fn(),
			onNewDraftRoute: vi.fn().mockResolvedValue(undefined),
			...input,
			...overrides,
		};
	}

	act(() => {
		root.render(<ComposerRegion {...props()} />);
	});

	return {
		rerender(overrides: Partial<Parameters<typeof ComposerRegion>[0]>) {
			root.render(<ComposerRegion {...props(overrides)} />);
		},
		unmount() {
			act(() => {
				root.unmount();
			});
			rootElement.remove();
		},
	};
}

function sessionStub(
	overrides: Partial<ComposerRegionSession> = {},
): ComposerRegionSession {
	return {
		draftId: "draft-db-1",
		conversationId: undefined,
		isTurnRunning: false,
		isTurnActive: false,
		pendingRequests: [],
		loadComposerDraft: vi.fn().mockResolvedValue(undefined),
		persistDraft: vi.fn().mockResolvedValue(undefined),
		clearComposerDraft: vi.fn().mockResolvedValue(undefined),
		sendAdmittedRequest: vi.fn().mockResolvedValue(true),
		enqueueAdmittedRequest: vi.fn().mockResolvedValue({
			id: "queue-1",
			conversationId: "conversation-1",
			admittedRequestId: "admitted-1",
			position: 0,
			status: "queued",
			createdAt: "2026-06-24T00:00:00.000Z",
			updatedAt: "2026-06-24T00:00:00.000Z",
		}),
		cancelQueuedRequest: vi.fn().mockResolvedValue(undefined),
		listQueuedRequests: vi.fn().mockResolvedValue([]),
		executeNextQueuedRequest: vi
			.fn()
			.mockResolvedValue({ ok: true, executed: false }),
		reportComposerAdmissionBlock: vi.fn(),
		interruptConversation: vi.fn().mockResolvedValue(undefined),
		createNewSession: vi.fn().mockResolvedValue(undefined),
		respondToRequest: vi
			.fn()
			.mockImplementation(
				(_requestId: string, _response: RespondSessionRequestInput) =>
					Promise.resolve(),
			),
		...overrides,
	};
}

function persistedQueueItem(id: string, prompt: string): PersistedQueueItem {
	return {
		id,
		conversationId: "conversation-1",
		admittedRequestId: `${id}:admitted`,
		position: id.endsWith("1") ? 0 : 1,
		status: "queued",
		request: {
			id: `${id}:request`,
			draftSnapshot: {},
			requestParts: [],
			providerInput: { provider: "codex", prompt },
			admission: {},
		},
		createdAt: "2026-06-24T00:00:00.000Z",
		updatedAt: "2026-06-24T00:00:00.000Z",
	};
}

function draftRecord(overrides: Partial<DraftRecord> = {}): DraftRecord {
	return {
		id: "draft-db-1",
		text: "",
		runtimeMode: "read-only",
		attachments: [],
		payload: {
			version: 2,
			target: { kind: "draft", id: "draft-db-1" },
			input: {
				text: "",
				mode: "ask",
				model: "gpt-5.4-mini",
				runtimeMode: "read-only",
				contextItems: [],
				attachments: [],
				selection: { start: 0, end: 0 },
				payload: {},
			},
			pendingRequestAnswerDrafts: {},
			updatedAt: "2026-06-24T00:00:00.000Z",
		},
		version: 2,
		mode: "ask",
		status: "active",
		createdAt: "2026-06-24T00:00:00.000Z",
		updatedAt: "2026-06-24T00:00:00.000Z",
		...overrides,
	};
}
