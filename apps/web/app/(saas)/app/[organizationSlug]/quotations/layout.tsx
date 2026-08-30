import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";
import {
	QuotationsLayoutClient,
	QuotationsLayoutFallback,
} from "./quotations-layout-client";

export const instant = true;

export default function QuotationsLayout({
	params,
	children,
}: {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
}) {
	return (
		<QuotationsLayoutClient>
			<Suspense fallback={<QuotationsLayoutFallback />}>
				<StudioRouteGuard params={params} routePath="/quotations">
					{() => children}
				</StudioRouteGuard>
			</Suspense>
		</QuotationsLayoutClient>
	);
}
