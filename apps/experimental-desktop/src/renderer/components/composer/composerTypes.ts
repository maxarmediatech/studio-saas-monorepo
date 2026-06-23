import type { ComposerMode } from "./composerTriggers";

export type ComposerContextItem = {
	type: "file" | "directory" | "workspace" | "skill" | "terminal";
	label: string;
	path: string;
	description?: string;
};

export type ComposerHistoryEntry = {
	mode: ComposerMode;
	text: string;
	contextItems?: ComposerContextItem[];
};

export type ComposerSavedDraft = {
	mode: ComposerMode;
	text: string;
	contextItems: ComposerContextItem[];
};
