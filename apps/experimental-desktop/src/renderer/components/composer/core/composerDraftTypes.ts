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
	updatedAt: number;
};

export function createComposerDraft(input: {
	text: string;
	mode: ComposerMode;
	model: string;
	runtimeMode: CodexRuntimeMode;
	contextItems: ComposerContextItem[];
	attachments: ComposerAttachment[];
	updatedAt?: number;
}): ComposerDraft {
	return {
		version: composerDraftVersion,
		text: input.text,
		mode: input.mode,
		model: input.model,
		runtimeMode: input.runtimeMode,
		contextItems: input.contextItems,
		attachments: input.attachments,
		updatedAt: input.updatedAt ?? Date.now(),
	};
}
