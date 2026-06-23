import type { ComposerMode } from "./composerTriggers";

export type ComposerContextItem = {
	type: "file" | "directory" | "workspace" | "skill" | "terminal";
	label: string;
	path: string;
	description?: string;
};

export type ComposerAttachment = {
	id: string;
	kind: "file" | "image";
	name: string;
	path?: string;
	mimeType?: string;
	size?: number;
	previewUrl?: string;
	status?: "ready" | "failed";
	error?: string;
};

export type ComposerHistoryEntry = {
	mode: ComposerMode;
	text: string;
	contextItems?: ComposerContextItem[];
	attachments?: ComposerAttachment[];
};

export type ComposerSavedDraft = {
	mode: ComposerMode;
	text: string;
	contextItems: ComposerContextItem[];
	attachments: ComposerAttachment[];
};
