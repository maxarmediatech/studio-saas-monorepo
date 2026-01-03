/**
 * Cache Revalidation Utilities
 *
 * Utilities for revalidating cached server components when data changes.
 * Used primarily for configuration data that is cached per organization.
 */

import { revalidateTag } from "next/cache";

/**
 * Revalidate cached configuration data for an organization
 *
 * Call this after creating, updating, or deleting any configuration
 * to ensure the cached data is refreshed.
 *
 * @param organizationId - The organization ID to revalidate cache for
 *
 * @example
 * ```ts
 * // After updating a booking type configuration
 * await updateConfiguration(input);
 * revalidateConfigurations(organizationId);
 * ```
 */
export function revalidateConfigurations(organizationId: string): void {
	// In Next.js 16, revalidateTag requires a second parameter (cache life config)
	// Using 0 to immediately invalidate the cache
	revalidateTag(`configurations-${organizationId}`, { expire: 0 });
}

/**
 * Revalidate specific configuration type cache
 *
 * Use this for more granular cache invalidation when you know
 * exactly which configuration type changed.
 *
 * @param organizationId - The organization ID
 * @param type - The configuration type (e.g., 'booking_type', 'package_type')
 *
 * @example
 * ```ts
 * // After updating only booking types
 * revalidateConfigurationType(organizationId, 'booking_type');
 * ```
 */
export function revalidateConfigurationType(
	organizationId: string,
	type:
		| "booking_type"
		| "package_type"
		| "relation_type"
		| "crew_role"
		| "shoot_status",
): void {
	revalidateTag(`${type}s-${organizationId}`, { expire: 0 });
	// Also revalidate the general configurations cache
	revalidateTag(`configurations-${organizationId}`, { expire: 0 });
}
