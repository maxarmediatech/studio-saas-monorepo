import type { ComposerContextItem } from "./composerTypes";

export function collectContextTokens(text: string) {
	const matches = text.match(/(?:^|\s)([@$>][^\s]+)/g) ?? [];
	return matches.map((match) => match.trim()).slice(0, 6);
}

export function withContextItems(text: string, items: ComposerContextItem[]) {
	const trimmed = text.trim();
	if (!items.length) {
		return trimmed;
	}
	const context = items
		.map((item) => `- ${item.type}: ${item.label}\n  path: ${item.path}`)
		.join("\n");
	return `Context files:\n${context}\n\nUser request:\n${trimmed}`.trim();
}
