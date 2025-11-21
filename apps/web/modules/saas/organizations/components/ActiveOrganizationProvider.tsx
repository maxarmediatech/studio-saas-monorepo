"use client";

import { authClient } from "@repo/auth/client";
import { isOrganizationAdmin } from "@repo/auth/lib/helper";
import { config } from "@repo/config";
import { useSession } from "@saas/auth/hooks/use-session";
import { sessionQueryKey } from "@saas/auth/lib/api";
import {
	activeOrganizationQueryKey,
	useActiveOrganizationQuery,
	useOrganizationListQuery,
} from "@saas/organizations/lib/api";
import { useRouter } from "@shared/hooks/router";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import nProgress from "nprogress";
import { type ReactNode, useEffect, useState } from "react";
import { ActiveOrganizationContext } from "../lib/active-organization-context";

export function ActiveOrganizationProvider({
	children,
}: {
	children: ReactNode;
}) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { session, user } = useSession();
	const params = useParams();
	const { data: organizations } = useOrganizationListQuery();

	const activeOrganizationSlug =
		(params.organizationSlug as string | undefined) ||
		organizations?.find(
			(org) => org.id === session?.session?.activeOrganizationId,
		)?.slug ||
		organizations?.[0]?.slug ||
		"";
	const locale = params.locale as string | undefined;
	const localePrefix = locale ? `/${locale}` : "";
	const hasActiveOrganizationSlug = activeOrganizationSlug.length > 0;

	const { data: activeOrganization } = useActiveOrganizationQuery(
		activeOrganizationSlug,
		{
			enabled: hasActiveOrganizationSlug,
		},
	);

	const refetchActiveOrganization = async () => {
		if (!hasActiveOrganizationSlug) {
			return;
		}

		await queryClient.refetchQueries({
			queryKey: activeOrganizationQueryKey(activeOrganizationSlug),
		});
	};

	const setActiveOrganization = async (organizationSlug: string | null) => {
		nProgress.start();
		const { data: newActiveOrganization } =
			await authClient.organization.setActive(
				organizationSlug
					? {
							organizationSlug,
						}
					: {
							organizationId: null,
						},
			);

		if (!newActiveOrganization) {
			nProgress.done();
			return;
		}

		await refetchActiveOrganization();

		if (config.organizations.enableBilling) {
			await queryClient.prefetchQuery(
				orpc.payments.listPurchases.queryOptions({
					input: {
						organizationId: newActiveOrganization.id,
					},
				}),
			);
		}

		await queryClient.setQueryData(sessionQueryKey, (data: any) => {
			return {
				...data,
				session: {
					...data?.session,
					activeOrganizationId: newActiveOrganization.id,
				},
			};
		});

		router.push(`${localePrefix}/${newActiveOrganization.slug}`);
	};

	const [loaded, setLoaded] = useState(
		activeOrganization !== undefined || !hasActiveOrganizationSlug,
	);

	useEffect(() => {
		if (!loaded && (activeOrganization !== undefined || !hasActiveOrganizationSlug)) {
			setLoaded(true);
		}
	}, [activeOrganization, hasActiveOrganizationSlug, loaded]);

	const activeOrganizationUserRole = activeOrganization?.members.find(
		(member) => member.userId === session?.userId,
	)?.role;

	return (
		<ActiveOrganizationContext.Provider
			value={{
				loaded,
				activeOrganization: activeOrganization ?? null,
				activeOrganizationUserRole: activeOrganizationUserRole ?? null,
				isOrganizationAdmin:
					!!activeOrganization &&
					!!user &&
					isOrganizationAdmin(activeOrganization, user),
				setActiveOrganization,
				refetchActiveOrganization,
			}}
		>
			{children}
		</ActiveOrganizationContext.Provider>
	);
}
