import type { WorkspaceFileMention } from "../../../preload/types";
import type { ComposerCommand, ComposerTrigger } from "./composerTriggers";
import { composerCommands } from "./composerTriggers";

export function buildComposerMenuItems(
	activeTrigger: ComposerTrigger | null,
	fileSearch: {
		results: WorkspaceFileMention[];
		loading: boolean;
		error: boolean;
	},
) {
	if (!activeTrigger) {
		return [];
	}
	const query = activeTrigger.query.toLowerCase();
	if (activeTrigger.kind === "slash") {
		return composerCommands
			.map(withCommandSection)
			.filter((command) =>
				command.trigger.toLowerCase().startsWith(query),
			);
	}
	if (activeTrigger.kind === "file") {
		const resultItems = fileSearch.results.map((file) => ({
			id: `workspace-file:${file.path}`,
			trigger: file.name,
			label: file.name,
			description: `${file.kind} · ${file.relativePath}`,
			action: "insert" as const,
			insertText: `@${file.name} `,
			section: "Workspace",
			shortcut: `@${file.name}`,
		}));
		const statusItems = fileSearch.loading
			? [statusItem("workspace-searching", "Searching workspace...")]
			: fileSearch.error
				? [statusItem("workspace-error", "Could not search files")]
				: query && resultItems.length === 0
					? [statusItem("workspace-empty", "No files found")]
					: [];
		return [
			{
				id: "choose-file",
				trigger: "file",
				label: "Choose File",
				description: "Attach a local file path.",
				action: "insert",
				insertText: "@",
				section: "Workspace",
				shortcut: "@file",
			},
			{
				id: "current-workspace",
				trigger: "workspace",
				label: "Current Workspace",
				description: "Reference the selected folder.",
				action: "insert",
				insertText: "@workspace ",
				section: "Workspace",
				shortcut: "@workspace",
			},
			...resultItems,
			...statusItems,
		] satisfies ComposerCommand[];
	}
	if (activeTrigger.kind === "skill") {
		const skillItems: ComposerCommand[] = [
			{
				id: "apply-patch",
				trigger: "apply_patch",
				label: "apply_patch",
				description: "Ask Codex to patch files.",
				action: "insert",
				insertText: "$apply_patch ",
				section: "Skills",
				shortcut: "$apply_patch",
			},
			{
				id: "run-tests",
				trigger: "run_tests",
				label: "run_tests",
				description: "Ask Codex to validate changes.",
				action: "insert",
				insertText: "$run_tests ",
				section: "Skills",
				shortcut: "$run_tests",
			},
		];
		return skillItems.filter((item) => item.trigger.startsWith(query));
	}
	return [
		{
			id: "terminal-context",
			trigger: "terminal",
			label: "Terminal Context",
			description: "Reference latest terminal output.",
			action: "insert",
			insertText: ">latest-terminal ",
			section: "Terminal",
			shortcut: ">latest-terminal",
		},
	] satisfies ComposerCommand[];
}

function withCommandSection(command: ComposerCommand): ComposerCommand {
	return {
		...command,
		section: "Commands",
		shortcut: `/${command.trigger}`,
	};
}

function statusItem(id: string, label: string): ComposerCommand {
	return {
		id,
		trigger: label,
		label,
		description: "",
		action: "insert",
		section: "Workspace",
		disabled: true,
	};
}
