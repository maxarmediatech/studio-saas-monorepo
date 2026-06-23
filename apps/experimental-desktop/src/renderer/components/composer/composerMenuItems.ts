import type { WorkspaceFileMention } from "../../../preload/types";
import type { ComposerCommand, ComposerTrigger } from "./composerTriggers";
import { composerCommands } from "./composerTriggers";

export function buildComposerMenuItems(
	activeTrigger: ComposerTrigger | null,
	fileResults: WorkspaceFileMention[],
) {
	if (!activeTrigger) {
		return [];
	}
	const query = activeTrigger.query.toLowerCase();
	if (activeTrigger.kind === "slash") {
		return composerCommands.filter((command) =>
			command.trigger.toLowerCase().startsWith(query),
		);
	}
	if (activeTrigger.kind === "file") {
		const resultItems = fileResults.map((file) => ({
			id: `workspace-file:${file.path}`,
			trigger: file.name,
			label: file.name,
			description: `${file.kind} · ${file.relativePath}`,
			action: "insert" as const,
			insertText: `@${file.name} `,
		}));
		return [
			{
				id: "choose-file",
				trigger: "file",
				label: "Choose File",
				description: "Attach a local file path.",
				action: "insert",
				insertText: "@",
			},
			{
				id: "current-workspace",
				trigger: "workspace",
				label: "Current Workspace",
				description: "Reference the selected folder.",
				action: "insert",
				insertText: "@workspace ",
			},
			...resultItems,
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
			},
			{
				id: "run-tests",
				trigger: "run_tests",
				label: "run_tests",
				description: "Ask Codex to validate changes.",
				action: "insert",
				insertText: "$run_tests ",
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
		},
	] satisfies ComposerCommand[];
}
