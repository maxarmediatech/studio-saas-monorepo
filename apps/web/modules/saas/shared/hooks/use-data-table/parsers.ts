import { parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs";
import { getSortingStateParser } from "./sorting-state-parser";

export { getSortingStateParser };

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
