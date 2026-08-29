import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type PropsWithChildren, Suspense } from "react";
import { ConfigurationsLayoutFallback } from "./configurations-layout-fallback";

type Props = PropsWithChildren<{
	params: Promise<{ organizationSlug: string }>;
}>;

export const instant = true;

export default function ConfigurationsLayout({ children, params }: Props) {
	return (
		<Suspense fallback={<ConfigurationsLayoutFallback />}>
			<StudioRouteGuard
				params={params}
				routePath="/configurations/booking-types"
			>
				{() => children}
			</StudioRouteGuard>
		</Suspense>
	);
}
