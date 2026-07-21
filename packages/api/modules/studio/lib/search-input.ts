const MONEY_QUERY_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const LEADING_CURRENCY_PATTERN = /^[₹$€£]\s*/;
const REFERENCE_LETTER_PATTERN = /[A-Z]/;
const REFERENCE_DIGIT_PATTERN = /\d/;
const ALLOWED_REFERENCE_QUERY_PATTERN = /^[A-Z0-9\s/-]+$/;
const REFERENCE_SEPARATOR_PATTERN = /[-\s/]+/g;

/** Escape user input so PostgreSQL LIKE wildcard characters remain literal. */
export function buildContainsPattern(query: string): string | null {
	const trimmed = query.trim();
	if (!trimmed) {
		return null;
	}

	const escaped = trimmed.replace(/[\\%_]/g, "\\$&");
	return `%${escaped}%`;
}

/** Normalize identifier-like input for separator-insensitive reference matching. */
export function buildCompactReferenceQuery(query: string): string | null {
	const normalized = query.trim().toUpperCase();
	if (!ALLOWED_REFERENCE_QUERY_PATTERN.test(normalized)) {
		return null;
	}

	const compact = normalized.replace(REFERENCE_SEPARATOR_PATTERN, "");
	if (
		compact.length < 3 ||
		!REFERENCE_LETTER_PATTERN.test(compact) ||
		!REFERENCE_DIGIT_PATTERN.test(compact)
	) {
		return null;
	}

	return compact;
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
