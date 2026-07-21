const MONEY_QUERY_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const LEADING_CURRENCY_PATTERN = /^[₹$€£]\s*/;

/** Escape user input so PostgreSQL LIKE wildcard characters remain literal. */
export function buildContainsPattern(query: string): string | null {
	const trimmed = query.trim();
	if (!trimmed) {
		return null;
	}

	const escaped = trimmed.replace(/[\\%_]/g, "\\$&");
	return `%${escaped}%`;
}

/** Normalize a whole-query monetary value for exact decimal comparisons. */
export function parseExactMoneyQuery(query: string): string | null {
	const normalized = query
		.trim()
		.replace(LEADING_CURRENCY_PATTERN, "")
		.replace(/[\s,]/g, "");

	if (!MONEY_QUERY_PATTERN.test(normalized)) {
		return null;
	}

	const [wholePart, fractionPart = ""] = normalized.split(".");
	const whole = wholePart.replace(/^0+(?=\d)/, "");
	return `${whole}.${fractionPart.padEnd(2, "0")}`;
}
