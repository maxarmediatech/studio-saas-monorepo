import { useCallback, useMemo, useState } from "react";
import type { CodexRuntimeMode } from "../../../../preload/types";
import type { ComposerMode } from "../composerTriggers";
import type { ComposerAttachment, ComposerContextItem } from "../composerTypes";
import { createComposerDraft } from "./composerDraftTypes";

export function useComposerDraftStore(input: {
	model: string;
	runtimeMode: CodexRuntimeMode;
}) {
	const [text, setText] = useState("");
	const [mode, setMode] = useState<ComposerMode>("ask");
	const [contextItems, setContextItems] = useState<ComposerContextItem[]>(
		[],
	);
	const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
	const [resetSignal, setResetSignal] = useState(0);

	const draft = useMemo(() => {
		return createComposerDraft({
			text,
			mode,
			model: input.model,
			runtimeMode: input.runtimeMode,
			contextItems,
			attachments,
		});
	}, [
		text,
		mode,
		input.model,
		input.runtimeMode,
		contextItems,
		attachments,
	]);

	const reset = useCallback(() => {
		setText("");
		setMode("ask");
		setContextItems([]);
		setAttachments([]);
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
		resetSignal,
		reset,
	};
}
