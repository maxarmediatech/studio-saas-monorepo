import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { filterCommands, type SlashCommand } from "./commands";

export interface SlashCommandsOptions {
	commands?: SlashCommand[];
}

export interface SlashCommandSuggestionRenderer {
	onStart: (props: SlashCommandSuggestionProps) => void;
	onUpdate: (props: SlashCommandSuggestionProps) => void;
	onKeyDown: (props: { event: KeyboardEvent }) => boolean;
	onExit: () => void;
}

export interface SlashCommandSuggestionProps {
	items: SlashCommand[];
	clientRect?: (() => DOMRect | null) | null;
	editor: any;
}

export function createSlashCommandsExtension(
	suggestionRenderer: SlashCommandSuggestionRenderer,
) {
	return Extension.create<SlashCommandsOptions>({
		name: "slashCommands",

		addOptions() {
			return {
				commands: undefined,
			};
		},

		addProseMirrorPlugins() {
			return [
				Suggestion({
					editor: this.editor,
					char: "/",
					startOfLine: true,
					items: ({ query }) => filterCommands(query),
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					render: () => suggestionRenderer as any,
				}),
			];
		},
	});
}
