/**
 * Cached server component for configuration options
 *
 * This component prefetches and caches configuration data (booking types, package types, relation types)
 * that are static per organization. Uses 'use cache' directive for Next.js Cache Components.
 *
 * Wraps children in HydrationBoundary to provide cached data to client queries.
 *
 * **Cache Invalidation:**
 * When configurations are updated, use the `revalidateConfigurations` utility:
 *
 * ```ts
 * import { revalidateConfigurations } from "@saas/studio/lib/cache-revalidation";
 *
 * // After updating any configuration
 * revalidateConfigurations(organizationId);
 * ```
 *
 * This will invalidate the cache and force a fresh fetch on the next request.
 */

import { configurationsApi } from "@saas/studio/lib/api";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { cacheTag } from "next/cache";
import type { ReactNode } from "react";

interface ConfigurationsProviderProps {
	organizationId: string;
	children: ReactNode;
}

export default async function ConfigurationsProvider({
	organizationId,
	children,
}: ConfigurationsProviderProps) {
	"use cache";
	cacheTag(`configurations-${organizationId}`);

	const queryClient = getServerQueryClient();

	// Prefetch all configuration types in parallel
	await Promise.all([
		queryClient.prefetchQuery(configurationsApi.bookingTypesOptions()),
		queryClient.prefetchQuery(configurationsApi.packageTypesOptions()),
		queryClient.prefetchQuery(configurationsApi.relationTypesOptions()),
		queryClient.prefetchQuery(configurationsApi.shootStatusOptions()),
		queryClient.prefetchQuery(configurationsApi.specialisationsOptions()),
	]);

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			{children}
		</HydrationBoundary>
	);
}
