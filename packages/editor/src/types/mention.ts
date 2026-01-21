export interface MentionSuggestion {
	id: string;
	label: string;
	avatar?: string | null;
	email?: string | null;
}

export interface MentionSection {
	title?: string;
	items: MentionSuggestion[];
}

export interface MentionHandler {
	search: (query: string) => Promise<MentionSuggestion[]>;
	onSelect?: (mention: MentionSuggestion) => void;
}

export interface ExtractedMention {
	userId: string;
	label: string;
}
