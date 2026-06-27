import type { CodexRuntimeMode } from "../../../../preload/types";
import type { ComposerMode } from "../composerTriggers";
import type { ComposerAttachment, ComposerContextItem } from "../composerTypes";

export const composerDraftVersion = 1;

export type ComposerDraft = {
	version: typeof composerDraftVersion;
	text: string;
	mode: ComposerMode;
	model: string;
	runtimeMode: CodexRuntimeMode;
	contextItems: ComposerContextItem[];
	attachments: ComposerAttachment[];
	selection: { start: number; end: number };
	updatedAt: number;
};

export function createComposerDraft(input: {
	text: string;
	mode: ComposerMode;
	model: string;
	runtimeMode: CodexRuntimeMode;
	contextItems: ComposerContextItem[];
	attachments: ComposerAttachment[];
	selection?: { start: number; end: number };
	updatedAt?: number;
}): ComposerDraft {
	const selection = normalizeSelection(input.selection, input.text.length);
	return {
		version: composerDraftVersion,
		text: input.text,
		mode: input.mode,
		model: input.model,
		runtimeMode: input.runtimeMode,
		contextItems: input.contextItems,
		attachments: input.attachments,
		selection,
		updatedAt: input.updatedAt ?? Date.now(),
	};
}

function normalizeSelection(
	selection: { start: number; end: number } | undefined,
	length: number,
) {
	if (!selection) {
		return { start: length, end: length };
	}
	const start = clamp(selection.start, length);
	const end = clamp(selection.end, length);
	return start <= end ? { start, end } : { start: end, end: start };
}

function clamp(value: number, length: number) {
	return Number.isFinite(value)
		? Math.min(length, Math.max(0, Math.trunc(value)))
		: length;
}
