import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";
import {
	ReceiptsLayoutClient,
	ReceiptsLayoutFallback,
} from "./receipts-layout-client";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export const instant = true;

export default function ReceiptsLayout({ params, children }: Props) {
	return (
		<ReceiptsLayoutClient>
			<Suspense fallback={<ReceiptsLayoutFallback />}>
				<StudioRouteGuard params={params} routePath="/receipts">
					{() => children}
				</StudioRouteGuard>
			</Suspense>
		</ReceiptsLayoutClient>
	);
}
