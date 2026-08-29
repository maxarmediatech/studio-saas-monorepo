import { PageContent } from "@saas/studio";
import { OpenClientCreateSheet } from "@saas/studio/components/clients/OpenClientSheet";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function ClientsLayout({ children, params }: Props) {
	return (
		<Suspense fallback={<PageContent title="Clients" />}>
			<StudioRouteGuard params={params} routePath="/clients">
				{() => (
					<PageContent
						title="Clients"
						controls={<OpenClientCreateSheet size="sm" />}
					>
						{children}
					</PageContent>
				)}
			</StudioRouteGuard>
		</Suspense>
	);
}
