import Mention from "@tiptap/extension-mention";
import type { MentionSuggestion } from "../../types/mention";

export interface MentionExtensionOptions {
	onSearch: (
		query: string,
	) => Promise<MentionSuggestion[]> | MentionSuggestion[];
	onSelect?: (item: MentionSuggestion) => void;
}

export interface MentionSuggestionRenderer {
	onStart: (props: MentionSuggestionProps) => void;
	onUpdate: (props: MentionSuggestionProps) => void;
	onKeyDown: (props: { event: KeyboardEvent }) => boolean;
	onExit: () => void;
}

export interface MentionSuggestionProps {
	items: MentionSuggestion[];
	command: (item: { id: string; label: string }) => void;
	clientRect?: (() => DOMRect | null) | null;
}

export function createMentionExtension(
	options: MentionExtensionOptions,
	suggestionRenderer: MentionSuggestionRenderer,
) {
	return Mention.configure({
		HTMLAttributes: {
			class: "mention",
			"data-type": "mention",
		},
		suggestion: {
			char: "@",
			allowSpaces: true,
			items: async ({ query }) => {
				const results = await options.onSearch(query);
				return results.slice(0, 10);
			},
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			render: () => suggestionRenderer as any,
		},
	});
}
