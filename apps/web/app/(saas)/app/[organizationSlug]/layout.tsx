import { Suspense } from "react";
import { config } from "@repo/config";
import { getActiveOrganization, getSession } from "@saas/auth/lib/server";
import { activeOrganizationQueryKey } from "@saas/organizations/lib/api";
import { SheetProvider } from "@saas/shared/components/sheet-provider";
import { AppShell } from "@saas/studio/components/app-shell";
import { GlobalSheets } from "@saas/studio/components/global-sheets";
import { orpc } from "@shared/lib/orpc-query-utils";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";
import type { PropsWithChildren } from "react";

type Props = PropsWithChildren & {
	params: Promise<{
		organizationSlug: string;
	}>;
};

export default async function OrganizationLayout({ children, params }: Props) {
	const { organizationSlug } = await params;

	const [session, organization] = await Promise.all([
		getSession(),
		getActiveOrganization(organizationSlug),
	]);

	if (!session) {
		redirect("/sign-in");
	}

	if (!organization) {
		return notFound();
	}

	const queryClient = getServerQueryClient();

	await queryClient.prefetchQuery({
		queryKey: activeOrganizationQueryKey(organizationSlug),
		queryFn: () => organization,
	});

	if (config.organizations.enableBilling) {
		await queryClient.prefetchQuery(
			orpc.payments.listPurchases.queryOptions({
				input: {
					organizationId: organization.id,
				},
			}),
		);
	}

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<SheetProvider>
				<AppShell
					session={session}
					activeOrganization={organization}
				>
					{children}
				</AppShell>
				<Suspense fallback={null}>
					<GlobalSheets />
				</Suspense>
			</SheetProvider>
		</HydrationBoundary>
	);
}
