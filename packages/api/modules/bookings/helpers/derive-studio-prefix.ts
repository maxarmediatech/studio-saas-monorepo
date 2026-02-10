/**
 * Derive a short uppercase prefix from a studio (organization) name.
 *
 * - 1 word  → first 3 characters: "Snapworks" → "SNA"
 * - 2 words → first letter of each: "Acme Studios" → "AS"
 * - 3+ words → first letter of first 3 words: "The Royal Photo Co" → "TRP"
 *
 * Non-alphabetic words (e.g. "&", "-") are filtered out before derivation.
 * Falls back to "BKN" if the name is empty or produces no usable characters.
 */
export function deriveStudioPrefix(orgName: string): string {
	const words = orgName
		.trim()
		.split(/\s+/)
		.filter((w) => /[a-zA-Z]/.test(w));

	if (words.length === 0) {
		return "BKN";
	}

	if (words.length === 1) {
		return words[0].slice(0, 3).toUpperCase();
	}

	return words
		.slice(0, 3)
		.map((w) => w[0])
		.join("")
		.toUpperCase();
}
