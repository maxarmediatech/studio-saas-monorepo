import type { SortingState } from "@tanstack/react-table";
import { createParser } from "nuqs/server";
import { z } from "zod";

/**
 * Creates a JSON-based parser for TanStack Table SortingState.
 * Stores sorting as JSON in URL: ?sort=[{"id":"createdAt","desc":true}]
 *
 * Note: Keep this server-safe (no `nuqs` hooks) so it can be used from both
 * client `useDataTable` and server `createSearchParamsCache`.
 */
export function getSortingStateParser(validColumnIds?: Set<string>) {
	const sortingItemSchema = z.object({
		id: z.string(),
		desc: z.boolean(),
	});

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
