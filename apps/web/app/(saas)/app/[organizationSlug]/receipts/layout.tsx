import { PageContent } from "@saas/studio";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";
import { ReceiptsLayoutClient } from "./receipts-layout-client";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function ReceiptsLayout({ params, children }: Props) {
	return (
		<Suspense fallback={<PageContent title="Receipts" />}>
			<StudioRouteGuard params={params} routePath="/receipts">
				{(organizationSlug) => (
					<ReceiptsLayoutClient organizationSlug={organizationSlug}>
						{children}
					</ReceiptsLayoutClient>
				)}
			</StudioRouteGuard>
		</Suspense>
	);
}
