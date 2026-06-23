import type { ComposerMode } from "./composerTriggers";

export type ComposerContextItem = {
	type: "file" | "directory";
	label: string;
	path: string;
};

export type ComposerHistoryEntry = {
	mode: ComposerMode;
	text: string;
	contextItems?: ComposerContextItem[];
};

export type ComposerSavedDraft = {
	text: string;
	contextItems: ComposerContextItem[];
};
