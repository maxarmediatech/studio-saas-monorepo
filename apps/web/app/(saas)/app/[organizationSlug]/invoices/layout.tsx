import { PageContent } from "@saas/studio";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";
import { InvoicesLayoutClient } from "./invoices-layout-client";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function InvoicesLayout({ params, children }: Props) {
	return (
		<Suspense fallback={<PageContent title="Invoices" />}>
			<StudioRouteGuard params={params} routePath="/invoices">
				{(organizationSlug) => (
					<InvoicesLayoutClient organizationSlug={organizationSlug}>
						{children}
					</InvoicesLayoutClient>
				)}
			</StudioRouteGuard>
		</Suspense>
	);
}
