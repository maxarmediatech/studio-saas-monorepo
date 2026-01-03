import type { SortingState } from "@tanstack/react-table";
import { parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs";
import { createParser } from "nuqs/server";
import { z } from "zod";

/**
 * Schema for validating sorting state items
 */
const sortingItemSchema = z.object({
	id: z.string(),
	desc: z.boolean(),
});

/**
 * Creates a JSON-based parser for TanStack Table SortingState.
 * Stores sorting as JSON in URL: ?sort=[{"id":"createdAt","desc":true}]
 *
 * @param validColumnIds - Optional set of valid column IDs for validation
 * @returns nuqs parser for SortingState
 *
 * @example
 * ```ts
 * const [sorting, setSorting] = useQueryState(
 *   "sort",
 *   getSortingStateParser().withDefault([{ id: "createdAt", desc: true }])
 * );
 * ```
 */
export function getSortingStateParser(validColumnIds?: Set<string>) {
	return createParser<SortingState>({
		parse: (value) => {
			try {
				const parsed = JSON.parse(value);
				const result = z.array(sortingItemSchema).safeParse(parsed);

				if (!result.success) {
					return null;
				}

				// Validate column IDs if provided
				if (
					validColumnIds &&
					result.data.some((item) => !validColumnIds.has(item.id))
				) {
					return null;
				}

				return result.data;
			} catch {
				return null;
			}
		},
		serialize: (value) => JSON.stringify(value),
		eq: (a, b) =>
			a.length === b.length &&
			a.every(
				(item, index) =>
					item.id === b[index]?.id && item.desc === b[index]?.desc,
			),
	});
}

/**
 * Standard parsers for pagination URL params
 */
export const paginationParsers = {
	page: parseAsInteger.withDefault(1),
	limit: parseAsInteger.withDefault(10),
};

/**
 * Standard parsers for sorting URL params
 */
export const sortingParsers = {
	sortBy: parseAsString,
	sortDirection: parseAsStringLiteral(["asc", "desc"] as const).withDefault(
		"desc",
	),
};

/**
 * Standard parser for search filter
 */
export const searchParser = parseAsString;

/**
 * Create pagination parsers with custom default limit
 */
export function createPaginationParsers(defaultLimit = 10) {
	return {
		page: parseAsInteger.withDefault(1),
		limit: parseAsInteger.withDefault(defaultLimit),
	};
}

/**
 * Create sorting parsers with custom defaults
 */
export function createSortingParsers(
	defaultSortBy?: string,
	defaultSortDirection: "asc" | "desc" = "desc",
) {
	return {
		sortBy: defaultSortBy
			? parseAsString.withDefault(defaultSortBy)
			: parseAsString,
		sortDirection: parseAsStringLiteral([
			"asc",
			"desc",
		] as const).withDefault(defaultSortDirection),
	};
}

// Re-export nuqs utilities for entity hooks
export {
	parseAsArrayOf,
	parseAsInteger,
	parseAsString,
	parseAsStringLiteral,
} from "nuqs";

// Re-export server utilities for search params cache
export { createSearchParamsCache } from "nuqs/server";
