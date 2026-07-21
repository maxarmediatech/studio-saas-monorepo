import { and, eq, isNull } from "@repo/database";
import { buildLiteralTextSearchCondition } from "../../studio/lib/entity-search";

/**
 * Build ILIKE conditions for multiple text fields
 * Returns undefined if query is empty
 */
export function buildTextSearchCondition(query: string, ...fields: unknown[]) {
	return buildLiteralTextSearchCondition(query, ...fields);
}

/**
 * Extract identifier patterns from search query
 * Handles: "BK-123", "INV-2024-001", "123"
 */
export function extractIdentifier(query: string): {
	pattern: string | null;
	number: string | null;
} {
	const trimmed = query.trim().toUpperCase();

	// Match full pattern: BK-123, INV-2024-001
	const fullMatch = trimmed.match(/^([A-Z]{2,})-?(\d+(?:-\d+)*)$/);
	if (fullMatch) {
		return {
			pattern: `${fullMatch[1]}-${fullMatch[2]}`, // Normalize to include dash
			number: fullMatch[2],
		};
	}

	// Match just numbers
	const numberMatch = trimmed.match(/^\d+$/);
	if (numberMatch) {
		return { pattern: null, number: trimmed };
	}

	return { pattern: null, number: null };
}

/**
 * Build base conditions for organization-scoped soft-deletable entities
 */
export function buildBaseConditions(table: any, organizationId: string) {
	return [eq(table.organizationId, organizationId), isNull(table.deletedAt)];
}

/**
 * Safely combine multiple conditions with AND
 * Filters out undefined/null values
 */
export function combineWithAnd(...conditions: unknown[]) {
	const valid = conditions.filter((c) => c != null);
	if (valid.length === 0) {
		return undefined;
	}
	if (valid.length === 1) {
		return valid[0];
	}
	return and(...(valid as any[]));
}
