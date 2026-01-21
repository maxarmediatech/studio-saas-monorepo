"use client";

import { createRoot, type Root } from "react-dom/client";
import type {
	MentionSuggestionProps,
	MentionSuggestionRenderer,
} from "./extension";
import { MentionList, type MentionListRef } from "./mention-list";

export function createMentionSuggestionRenderer(): MentionSuggestionRenderer {
	let root: Root | null = null;
	let container: HTMLElement | null = null;
	let componentRef: MentionListRef | null = null;

	return {
		onStart: (props: MentionSuggestionProps) => {
			container = document.createElement("div");
			container.className = "mention-suggestion-container";
			document.body.appendChild(container);

			root = createRoot(container);
			root.render(
				<MentionList
					items={props.items}
					command={props.command}
					ref={(ref) => {
						componentRef = ref;
					}}
				/>,
			);

			updatePosition(props);
		},

		onUpdate: (props: MentionSuggestionProps) => {
			if (root) {
				root.render(
					<MentionList
						items={props.items}
						command={props.command}
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

	function updatePosition(props: MentionSuggestionProps) {
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
