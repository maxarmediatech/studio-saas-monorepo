/**
 * Centralized query options for booking form components.
 *
 * These query factories ensure consistency across all booking form steps
 * and enable automatic deduplication by React Query (same query key = same cache entry).
 *
 * Usage:
 * ```tsx
 * import { bookingFormQueries } from "./booking-form-queries";
 * const { data } = useQuery(bookingFormQueries.clients());
 * ```
 */

import { clientsApi, configurationsApi, crewsApi } from "@saas/studio/lib/api";

/**
 * Default limit for dropdown lists in booking forms.
 * Increase if users typically have more than 100 clients/crews.
 */
const DROPDOWN_LIMIT = 100;

export const bookingFormQueries = {
	/**
	 * Clients for participant dropdowns (details step, review step)
	 */
	clients: () => clientsApi.listOptions({ limit: DROPDOWN_LIMIT }),

	/**
	 * Crew members for shoot/deliverable assignment (shoots, deliverables, review steps)
	 */
	crews: () => crewsApi.listOptions({ limit: DROPDOWN_LIMIT }),

	/**
	 * Configuration types - these are also prefetched by ConfigurationsProvider
	 * but can be called directly if needed
	 */
	bookingTypes: () => configurationsApi.bookingTypesOptions(),
	packageTypes: () => configurationsApi.packageTypesOptions(),
	relationTypes: () => configurationsApi.relationTypesOptions(),
	crewRoles: () => configurationsApi.specialisationsOptions(),
	eventTypes: () => configurationsApi.eventTypesOptions(),
} as const;
