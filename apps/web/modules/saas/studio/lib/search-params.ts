import type { SortingState } from "@tanstack/react-table";
import {
	createSearchParamsCache,
	parseAsArrayOf,
	parseAsInteger,
	parseAsString,
	parseAsStringLiteral,
} from "nuqs/server";
import { getSortingStateParser } from "../../shared/hooks/use-data-table/sorting-state-parser";

const sortStateParser = getSortingStateParser().withDefault([]);

export function getSortFromSearchParams(
	sort: SortingState | undefined,
	fallback: {
		sortBy: string;
		sortDirection: string;
	},
): { sortBy: string; sortDirection: "asc" | "desc" } {
	const firstSort = sort?.[0];
	// Note: `?sort=[]` intentionally falls back to the legacy `sortBy/sortDirection` params.
	if (firstSort?.id) {
		return {
			sortBy: firstSort.id,
			sortDirection: firstSort.desc ? "desc" : "asc",
		};
	}

	return {
		sortBy: fallback.sortBy,
		sortDirection: fallback.sortDirection === "asc" ? "asc" : "desc",
	};
}

/**
 * Booking phases for filter validation
 */
const BOOKING_PHASES = [
	"new",
	"preparation",
	"shooting",
	"delivery",
	"completed",
	"cancelled",
] as const;

/**
 * Server-side search params cache for bookings table.
 * Use in server components to parse URL params before prefetching.
 *
 * @example
 * ```tsx
 * // In page.tsx (server component)
 * export default async function BookingsPage({
 *   searchParams,
 * }: {
 *   searchParams: Promise<Record<string, string | string[]>>;
 * }) {
 *   const params = await bookingSearchParamsCache.parse(searchParams);
 *   // params.page, params.search, params.status, etc.
 * }
 * ```
 */
export const bookingSearchParamsCache = createSearchParamsCache({
	// Pagination
	page: parseAsInteger.withDefault(1),
	limit: parseAsInteger.withDefault(10),

	// Filters
	search: parseAsString,
	statuses: parseAsArrayOf(parseAsStringLiteral(BOOKING_PHASES)),
	bookingType: parseAsArrayOf(parseAsString, ","),
	packageType: parseAsArrayOf(parseAsString, ","),
	createdAt: parseAsArrayOf(parseAsString, ","),

	// Sorting
	sort: sortStateParser,
	sortBy: parseAsString.withDefault("createdAt"),
	sortDirection: parseAsStringLiteral(["asc", "desc"] as const).withDefault(
		"desc",
	),
});

/**
 * Type for parsed booking search params
 */
export type BookingSearchParams = ReturnType<
	typeof bookingSearchParamsCache.parse
>;

/**
 * Server-side search params cache for crews table.
 * Use in server components to parse URL params before prefetching.
 */
export const crewSearchParamsCache = createSearchParamsCache({
	// Pagination
	page: parseAsInteger.withDefault(1),
	limit: parseAsInteger.withDefault(10),

	// Filters
	search: parseAsString,
	status: parseAsArrayOf(parseAsString, ","),
	role: parseAsArrayOf(parseAsString, ","),

	// Sorting
	sort: sortStateParser,
	sortBy: parseAsString.withDefault("name"),
	sortDirection: parseAsStringLiteral(["asc", "desc"] as const).withDefault(
		"asc",
	),
});

/**
 * Type for parsed crew search params
 */
export type CrewSearchParams = ReturnType<typeof crewSearchParamsCache.parse>;

/**
 * Server-side search params cache for tasks table.
 * Use in server components to parse URL params before prefetching.
 */
export const taskSearchParamsCache = createSearchParamsCache({
	// Pagination
	page: parseAsInteger.withDefault(1),
	limit: parseAsInteger.withDefault(10),

	// Filters
	search: parseAsString,
	status: parseAsArrayOf(parseAsString, ","),
	priority: parseAsArrayOf(parseAsString, ","),

	// Sorting
	sort: sortStateParser,
	sortBy: parseAsString.withDefault("dueDate"),
	sortDirection: parseAsStringLiteral(["asc", "desc"] as const).withDefault(
		"asc",
	),
});

/**
 * Type for parsed task search params
 */
export type TaskSearchParams = ReturnType<typeof taskSearchParamsCache.parse>;

/**
 * Server-side search params cache for payments table.
 * Use in server components to parse URL params before prefetching.
 */
export const paymentSearchParamsCache = createSearchParamsCache({
	// Pagination
	page: parseAsInteger.withDefault(1),
	limit: parseAsInteger.withDefault(10),

	// Filters
	search: parseAsString,
	paymentMethod: parseAsArrayOf(parseAsString, ","),

	// Sorting
	sort: sortStateParser,
	sortBy: parseAsString.withDefault("receivedDate"),
	sortDirection: parseAsStringLiteral(["asc", "desc"] as const).withDefault(
		"desc",
	),
});

/**
 * Type for parsed payment search params
 */
export type PaymentSearchParams = ReturnType<
	typeof paymentSearchParamsCache.parse
>;

/**
 * Server-side search params cache for expenses table.
 * Use in server components to parse URL params before prefetching.
 */
export const expenseSearchParamsCache = createSearchParamsCache({
	// Pagination
	page: parseAsInteger.withDefault(1),
	limit: parseAsInteger.withDefault(10),

	// Filters
	search: parseAsString,
	category: parseAsArrayOf(parseAsString, ","),
	billTo: parseAsArrayOf(parseAsString, ","),
	paymentMethod: parseAsArrayOf(parseAsString, ","),

	// Sorting
	sort: sortStateParser,
	sortBy: parseAsString.withDefault("expenseDate"),
	sortDirection: parseAsStringLiteral(["asc", "desc"] as const).withDefault(
		"desc",
	),
});

/**
 * Type for parsed expense search params
 */
export type ExpenseSearchParams = ReturnType<
	typeof expenseSearchParamsCache.parse
>;

/**
 * Server-side search params cache for deliverables table.
 * Use in server components to parse URL params before prefetching.
 */
export const deliverableSearchParamsCache = createSearchParamsCache({
	// Pagination
	page: parseAsInteger.withDefault(1),
	limit: parseAsInteger.withDefault(10),

	// Filters
	search: parseAsString,
	deliverableType: parseAsArrayOf(parseAsString, ","),
	status: parseAsArrayOf(parseAsString, ","),
	priority: parseAsArrayOf(parseAsString, ","),

	// Sorting
	sort: sortStateParser,
	sortBy: parseAsString.withDefault("dueDate"),
	sortDirection: parseAsStringLiteral(["asc", "desc"] as const).withDefault(
		"asc",
	),
});

/**
 * Type for parsed deliverable search params
 */
export type DeliverableSearchParams = ReturnType<
	typeof deliverableSearchParamsCache.parse
>;

/**
 * Server-side search params cache for shoots table.
 * Use in server components to parse URL params before prefetching.
 */
export const shootSearchParamsCache = createSearchParamsCache({
	// Pagination
	page: parseAsInteger.withDefault(1),
	limit: parseAsInteger.withDefault(10),

	// Filters
	search: parseAsString,
	shootType: parseAsArrayOf(parseAsString, ","),
	status: parseAsArrayOf(parseAsString, ","),
	shootDate: parseAsArrayOf(parseAsString, ","),

	// Sorting
	sort: sortStateParser,
	sortBy: parseAsString.withDefault("shootDate"),
	sortDirection: parseAsStringLiteral(["asc", "desc"] as const).withDefault(
		"desc",
	),
});

/**
 * Type for parsed shoot search params
 */
export type ShootSearchParams = ReturnType<typeof shootSearchParamsCache.parse>;

/**
 * Server-side search params cache for clients table.
 * Use in server components to parse URL params before prefetching.
 */
export const clientSearchParamsCache = createSearchParamsCache({
	// Pagination
	page: parseAsInteger.withDefault(1),
	limit: parseAsInteger.withDefault(10),

	// Filters
	search: parseAsString,

	// Sorting
	sort: sortStateParser,
	sortBy: parseAsString.withDefault("name"),
	sortDirection: parseAsStringLiteral(["asc", "desc"] as const).withDefault(
		"asc",
	),
});

/**
 * Type for parsed client search params
 */
export type ClientSearchParams = ReturnType<
	typeof clientSearchParamsCache.parse
>;
