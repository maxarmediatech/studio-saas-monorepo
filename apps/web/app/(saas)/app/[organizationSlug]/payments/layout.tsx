import { PageContent } from "@saas/studio";
import { OpenPaymentCreateSheet } from "@saas/studio/components/payments/OpenPaymentSheet";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function PaymentsLayout({ children, params }: Props) {
	return (
		<Suspense fallback={<PageContent title="Payments" />}>
			<StudioRouteGuard params={params} routePath="/payments">
				{() => (
					<PageContent
						title="Payments"
						controls={<OpenPaymentCreateSheet size="sm" />}
					>
						{children}
					</PageContent>
				)}
			</StudioRouteGuard>
		</Suspense>
	);
}
