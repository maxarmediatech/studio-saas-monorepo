import { ClientsTableSkeleton, PageContent } from "@saas/studio";
import { OpenClientCreateSheet } from "@saas/studio/components/clients/OpenClientSheet";
import { StudioListRouteFallback } from "@saas/studio/components/StudioListRouteFallback";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export const instant = true;

export default function LeadsLayout({ children, params }: Props) {
	return (
		<PageContent
			title="Leads"
			controls={<OpenClientCreateSheet label="Add Lead" size="sm" />}
		>
			<Suspense
				fallback={
					<StudioListRouteFallback label="leads">
						<ClientsTableSkeleton />
					</StudioListRouteFallback>
				}
			>
				<StudioRouteGuard params={params} routePath="/leads">
					{() => children}
				</StudioRouteGuard>
			</Suspense>
		</PageContent>
	);
}
