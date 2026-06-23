import type { ComposerMode } from "./composerTriggers";

export type ComposerFolderMode =
	| "reference"
	| "tree"
	| "pattern"
	| "changed-files"
	| "summary";

export type ComposerFolderSnapshot = {
	mode: ComposerFolderMode;
	rootPath: string;
	fileCount: number;
	directoryCount: number;
	includedFileCount: number;
	ignoredCount: number;
	visitedCount: number;
	truncated: boolean;
	patterns?: string[];
	treeLines?: string[];
	includedPaths?: string[];
	extensions?: Array<{ extension: string; count: number }>;
	warnings: string[];
	approxChars: number;
	approxTokens: number;
	createdAt: string;
};

export type ComposerContextItem = {
	type: "file" | "directory" | "workspace" | "skill" | "terminal";
	label: string;
	path: string;
	description?: string;
	folderMode?: ComposerFolderMode;
	folderStatus?: "idle" | "scanning" | "ready" | "failed";
	folderSnapshot?: ComposerFolderSnapshot;
	folderError?: string;
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
