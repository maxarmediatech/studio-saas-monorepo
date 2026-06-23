import type {
	ComposerContextItem,
	ComposerFolderMode,
	ComposerFolderSnapshot,
} from "./composerTypes";

export const FOLDER_CONTEXT_MODES: Array<{
	mode: ComposerFolderMode;
	label: string;
	description: string;
}> = [
	{
		mode: "reference",
		label: "Ref",
		description: "Only pass the folder path as context.",
	},
	{
		mode: "tree",
		label: "Tree",
		description: "Include a bounded folder tree.",
	},
	{
		mode: "pattern",
		label: "Pattern",
		description: "Include matching source/doc files by pattern.",
	},
	{
		mode: "changed-files",
		label: "Changed",
		description: "Include Git changed files under this folder.",
	},
	{
		mode: "summary",
		label: "Summary",
		description: "Include a compact folder summary and extension counts.",
	},
];

export const DEFAULT_FOLDER_CONTEXT_PATTERNS = [
	"*.ts",
	"*.tsx",
	"*.js",
	"*.jsx",
	"*.json",
	"*.md",
	"*.css",
	"*.scss",
];

export function createFolderContextItem(input: {
	type: "directory" | "workspace";
	label: string;
	path: string;
	description?: string;
	mode?: ComposerFolderMode;
	snapshot?: ComposerFolderSnapshot;
}): ComposerContextItem {
	const mode = input.mode ?? "reference";
	return {
		type: input.type,
		label: input.label,
		path: input.path,
		description:
			input.description ?? folderDescription(mode, input.snapshot),
		folderMode: mode,
		folderStatus: input.snapshot ? "ready" : "idle",
		folderSnapshot: input.snapshot,
	};
}

export function folderDescription(
	mode: ComposerFolderMode,
	snapshot?: ComposerFolderSnapshot,
) {
	if (!snapshot || mode === "reference") {
		return "Folder reference only; contents are not included.";
	}
	const truncated = snapshot.truncated ? ", truncated" : "";
	const base = `${modeLabel(mode)} · ${snapshot.includedFileCount.toLocaleString()} included file${snapshot.includedFileCount === 1 ? "" : "s"} · ${snapshot.fileCount.toLocaleString()} total file${snapshot.fileCount === 1 ? "" : "s"}${truncated}`;
	return snapshot.warnings.length > 0
		? `${base} · ${snapshot.warnings[0]}`
		: base;
}

export function modeLabel(mode: ComposerFolderMode) {
	switch (mode) {
		case "reference":
			return "Reference";
		case "tree":
			return "Tree";
		case "pattern":
			return "Pattern";
		case "changed-files":
			return "Changed files";
		case "summary":
			return "Summary";
	}
}

export function isFolderContext(item: ComposerContextItem) {
	return item.type === "directory" || item.type === "workspace";
}
