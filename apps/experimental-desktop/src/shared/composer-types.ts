import type { CodexRuntimeMode } from "./runtime-mode";

export type ComposerMode = "ask" | "plan" | "build" | "review" | "shell";

export const composerModes: readonly ComposerMode[] = [
	"ask",
	"plan",
	"build",
	"review",
	"shell",
];

export function isComposerMode(value: unknown): value is ComposerMode {
	return (
		typeof value === "string" &&
		composerModes.includes(value as ComposerMode)
	);
}

export function normalizeComposerMode(
	value: unknown,
	fallback: ComposerMode = "ask",
): ComposerMode {
	return isComposerMode(value) ? value : fallback;
}

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

export type DurableComposerAttachment = Omit<ComposerAttachment, "previewUrl">;

export type ComposerSelection = {
	start: number;
	end: number;
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

export type ComposerDraftInput = {
	text: string;
	mode: ComposerMode;
	model: string | null;
	runtimeMode: CodexRuntimeMode;
	contextItems: ComposerContextItem[];
	attachments: DurableComposerAttachment[];
	selection: ComposerSelection;
	payload: unknown;
};
