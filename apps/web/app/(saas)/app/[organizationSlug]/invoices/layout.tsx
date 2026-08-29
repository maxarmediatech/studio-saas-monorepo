import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";
import {
	InvoicesLayoutClient,
	InvoicesLayoutFallback,
} from "./invoices-layout-client";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export const instant = true;

export default function InvoicesLayout({ params, children }: Props) {
	return (
		<InvoicesLayoutClient>
			<Suspense fallback={<InvoicesLayoutFallback />}>
				<StudioRouteGuard params={params} routePath="/invoices">
					{() => children}
				</StudioRouteGuard>
			</Suspense>
		</InvoicesLayoutClient>
	);
}
