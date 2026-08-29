import { PageContent } from "@saas/studio";
import { PaymentsTableSkeleton } from "@saas/studio/components/payments";
import { OpenPaymentCreateSheet } from "@saas/studio/components/payments/OpenPaymentSheet";
import { StudioListRouteFallback } from "@saas/studio/components/StudioListRouteFallback";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export const instant = true;

export default function PaymentsLayout({ children, params }: Props) {
	return (
		<PageContent
			title="Payments"
			controls={<OpenPaymentCreateSheet size="sm" />}
		>
			<Suspense
				fallback={
					<StudioListRouteFallback label="payments">
						<PaymentsTableSkeleton />
					</StudioListRouteFallback>
				}
			>
				<StudioRouteGuard params={params} routePath="/payments">
					{() => children}
				</StudioRouteGuard>
			</Suspense>
		</PageContent>
	);
}
