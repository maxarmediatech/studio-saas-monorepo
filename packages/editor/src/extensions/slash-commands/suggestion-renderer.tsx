"use client";

import { createRoot, type Root } from "react-dom/client";
import { CommandList, type CommandListRef } from "./command-list";
import type {
	SlashCommandSuggestionProps,
	SlashCommandSuggestionRenderer,
} from "./extension";

export function createSlashCommandSuggestionRenderer(): SlashCommandSuggestionRenderer {
	let root: Root | null = null;
	let container: HTMLElement | null = null;
	let componentRef: CommandListRef | null = null;

	return {
		onStart: (props: SlashCommandSuggestionProps) => {
			container = document.createElement("div");
			container.className = "slash-command-suggestion-container";
			document.body.appendChild(container);

			root = createRoot(container);
			root.render(
				<CommandList
					items={props.items}
					editor={props.editor}
					onClose={cleanup}
					ref={(ref) => {
						componentRef = ref;
					}}
				/>,
			);

			updatePosition(props);
		},

		onUpdate: (props: SlashCommandSuggestionProps) => {
			if (root) {
				root.render(
					<CommandList
						items={props.items}
						editor={props.editor}
						onClose={cleanup}
						ref={(ref) => {
							componentRef = ref;
						}}
					/>,
				);
			}

			updatePosition(props);
		},

		onKeyDown: (props: { event: KeyboardEvent }) => {
			if (props.event.key === "Escape") {
				cleanup();
				return true;
			}

			return componentRef?.onKeyDown({ event: props.event }) ?? false;
		},

		onExit: () => {
			cleanup();
		},
	};

	function updatePosition(props: SlashCommandSuggestionProps) {
		if (!container || !props.clientRect) return;

		const rect = props.clientRect();
		if (!rect) return;

		container.style.position = "fixed";
		container.style.left = `${rect.left}px`;
		container.style.top = `${rect.bottom + 4}px`;
		container.style.zIndex = "50";
	}

	function cleanup() {
		if (root) {
			root.unmount();
			root = null;
		}
		if (container) {
			container.remove();
			container = null;
		}
		componentRef = null;
	}
}
