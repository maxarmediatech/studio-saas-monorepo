// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useComposerDraftSync } from "../composerDraftSync";
import { createComposerDraft } from "../composerDraftTypes";

describe("useComposerDraftSync", () => {
	beforeEach(() => {
		(
			globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("does not restart the debounce when only persistDraft identity changes", () => {
		const firstPersist = vi.fn().mockResolvedValue(undefined);
		const secondPersist = vi.fn().mockResolvedValue(undefined);
		const rootElement = document.createElement("div");
		document.body.append(rootElement);
		const root = createRoot(rootElement);
		const draft = createComposerDraft({
			text: "remember this",
			mode: "ask",
			model: "gpt-5.4-mini",
			runtimeMode: "read-only",
			contextItems: [],
			attachments: [],
			updatedAt: 1,
		});

		function Harness(props: {
			persistDraft: Parameters<
				typeof useComposerDraftSync
			>[0]["persistDraft"];
		}) {
			useComposerDraftSync({
				draft,
				draftScopeId: "draft-1",
				persistDraft: props.persistDraft,
				debounceMs: 350,
			});
			return null;
		}

		act(() => {
			root.render(<Harness persistDraft={firstPersist} />);
		});
		act(() => {
			vi.advanceTimersByTime(200);
			root.render(<Harness persistDraft={secondPersist} />);
		});
		act(() => {
			vi.advanceTimersByTime(150);
		});

		expect(firstPersist).not.toHaveBeenCalled();
		expect(secondPersist).toHaveBeenCalledTimes(1);
		act(() => root.unmount());
		rootElement.remove();
	});
});
