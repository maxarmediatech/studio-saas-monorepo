export function collectContextTokens(text: string) {
	const matches = text.match(/(?:^|\s)([@$>][^\s]+)/g) ?? [];
	return matches.map((match) => match.trim()).slice(0, 6);
}
