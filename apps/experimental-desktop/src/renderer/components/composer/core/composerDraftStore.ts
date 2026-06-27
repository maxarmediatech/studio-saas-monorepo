import { useCallback, useMemo, useState } from "react";
import type { CodexRuntimeMode } from "../../../../preload/types";
import type { ComposerMode } from "../composerTriggers";
import type { ComposerAttachment, ComposerContextItem } from "../composerTypes";
import { createComposerDraft } from "./composerDraftTypes";

export type ComposerDraftHydration = {
	text: string;
	mode: ComposerMode;
	contextItems: ComposerContextItem[];
	attachments: ComposerAttachment[];
	selection?: { start: number; end: number };
};

export function useComposerDraftStore(input: {
	model: string;
	runtimeMode: CodexRuntimeMode;
}) {
	const [text, setText] = useState("");
	const [mode, setMode] = useState<ComposerMode>("ask");
	const [contextItems, setContextItems] = useState<ComposerContextItem[]>([]);
	const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
	const [selection, setSelection] = useState({ start: 0, end: 0 });
	const [resetSignal, setResetSignal] = useState(0);

	const draft = useMemo(() => {
		return createComposerDraft({
			text,
			mode,
			model: input.model,
			runtimeMode: input.runtimeMode,
			contextItems,
			attachments,
			selection,
		});
	}, [
		text,
		mode,
		input.model,
		input.runtimeMode,
		contextItems,
		attachments,
		selection,
	]);

	const reset = useCallback(() => {
		setText("");
		setMode("ask");
		setContextItems([]);
		setAttachments([]);
		setSelection({ start: 0, end: 0 });
		setResetSignal((signal) => signal + 1);
	}, []);

	const hydrate = useCallback((hydration: ComposerDraftHydration) => {
		setText(hydration.text);
		setMode(hydration.mode);
		setContextItems(hydration.contextItems);
		setAttachments(hydration.attachments);
		setSelection(
			hydration.selection ?? {
				start: hydration.text.length,
				end: hydration.text.length,
			},
		);
		setResetSignal((signal) => signal + 1);
	}, []);

	return {
		draft,
		text,
		setText,
		mode,
		setMode,
		contextItems,
		setContextItems,
		attachments,
		setAttachments,
		selection,
		setSelection,
		resetSignal,
		reset,
		hydrate,
	};
}
