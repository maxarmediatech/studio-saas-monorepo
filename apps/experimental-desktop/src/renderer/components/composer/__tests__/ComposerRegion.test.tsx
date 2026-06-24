// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RespondSessionRequestInput } from "../../../../preload/types";
import type { SessionComposer } from "../SessionComposer";
import type { ComposerQueuePanel } from "../ComposerQueuePanel";
import {
	ComposerRegion,
	type ComposerRegionSession,
} from "../ComposerRegion";

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
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
			true;
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
				model: "gpt-5.4-mini",
				runtimeMode: "read-only",
				payload: expect.objectContaining({ text: "remember this" }),
			}),
		);
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
		);
		expect(latestComposerProps?.value).toBe("");
		expect(latestComposerProps?.mode).toBe("ask");
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
		persistDraft: vi.fn().mockResolvedValue(undefined),
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
