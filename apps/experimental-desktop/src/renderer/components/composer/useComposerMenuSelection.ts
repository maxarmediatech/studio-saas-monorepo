import type { Dispatch, SetStateAction } from "react";
import type { WorkspaceFileMention } from "../../../preload/types";
import type {
	ComposerCommand,
	ComposerMode,
	ComposerTrigger,
} from "./composerTriggers";
import { replaceComposerRange } from "./composerTriggers";
import type { ComposerContextItem } from "./composerTypes";

export function useComposerMenuSelection(input: {
	trigger: ComposerTrigger | null;
	value: string;
	workspaceRoot?: string;
	fileResults: WorkspaceFileMention[];
	onChange: (value: string) => void;
	focusAt: (cursor: number) => void;
	changeMode: (mode: ComposerMode) => void;
	createNewSession: () => Promise<void>;
	setContextItems: Dispatch<SetStateAction<ComposerContextItem[]>>;
}) {
	async function chooseFile() {
		const path = await window.experimentalDesktop.openFile();
		if (!path || !input.trigger) {
			return;
		}
		const label = path.slice(
			Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1,
		);
		addContextItem(input.setContextItems, { type: "file", label, path });
		replaceTrigger(input, `@${label} `);
	}

	function selectItem(item: ComposerCommand) {
		const trigger = input.trigger;
		if (item.disabled) {
			return;
		}
		if (item.section === "Skills" && trigger) {
			addContextItem(input.setContextItems, {
				type: "skill",
				label: item.label,
				path: `skill:${item.id}`,
				description: item.description,
			});
			replaceTrigger(input, item.insertText ?? `$${item.trigger} `);
			return;
		}
		if (item.section === "Terminal" && trigger) {
			addContextItem(input.setContextItems, {
				type: "terminal",
				label: item.label,
				path: `terminal:${item.id}`,
				description: item.description,
			});
			replaceTrigger(input, item.insertText ?? `>${item.trigger} `);
			return;
		}
		if (item.id.startsWith("workspace-file:")) {
			const file = input.fileResults.find(
				(result) => `workspace-file:${result.path}` === item.id,
			);
			if (file && trigger) {
				addContextItem(input.setContextItems, {
					type: file.kind,
					label: file.relativePath,
					path: file.path,
				});
				replaceTrigger(input, `@${file.name} `);
			}
			return;
		}
		if (item.id === "current-workspace" && input.workspaceRoot && trigger) {
			addContextItem(input.setContextItems, {
				type: "workspace",
				label: input.workspaceRoot,
				path: input.workspaceRoot,
				description: "Current workspace root",
			});
			replaceTrigger(input, "@workspace ");
			return;
		}
		if (item.id === "choose-file") {
			void chooseFile();
			return;
		}
		if (item.action === "mode" && item.mode) {
			input.changeMode(item.mode);
			if (trigger) {
				replaceTrigger(input, "");
			}
			return;
		}
		if (item.action === "new-session") {
			void input.createNewSession();
			return;
		}
		if (item.action === "clear") {
			input.onChange("");
			input.setContextItems([]);
			return;
		}
		if (trigger) {
			replaceTrigger(input, item.insertText ?? `/${item.trigger} `);
		}
	}

	return { selectItem };
}

function addContextItem(
	setContextItems: Dispatch<SetStateAction<ComposerContextItem[]>>,
	item: ComposerContextItem,
) {
	setContextItems((items) =>
		items.some((existing) => existing.path === item.path)
			? items
			: [...items, item],
	);
}

function replaceTrigger(
	input: {
		trigger: ComposerTrigger | null;
		value: string;
		onChange: (value: string) => void;
		focusAt: (cursor: number) => void;
	},
	replacement: string,
) {
	if (!input.trigger) {
		return;
	}
	const next = replaceComposerRange(
		input.value,
		input.trigger.rangeStart,
		input.trigger.rangeEnd,
		replacement,
	);
	input.onChange(next.text);
	input.focusAt(next.cursor);
}
