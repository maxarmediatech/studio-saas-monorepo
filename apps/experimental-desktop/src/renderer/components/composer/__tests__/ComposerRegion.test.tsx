// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RespondSessionRequestInput } from "../../../../preload/types";
import type { SessionComposer } from "../SessionComposer";
import {
	ComposerRegion,
	type ComposerRegionSession,
} from "../ComposerRegion";

type SessionComposerProps = Parameters<typeof SessionComposer>[0];

let latestComposerProps: SessionComposerProps | undefined;

vi.mock("../SessionComposer", () => ({
	SessionComposer: (props: SessionComposerProps) => {
		latestComposerProps = props;
		return null;
	},
}));

describe("ComposerRegion", () => {
	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
			true;
		latestComposerProps = undefined;
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
