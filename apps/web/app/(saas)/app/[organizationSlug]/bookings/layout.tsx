import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";
import {
	BookingsLayoutClient,
	BookingsLayoutFallback,
} from "./bookings-layout-client";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export const instant = true;

export default function BookingsLayout({ params, children }: Props) {
	return (
		<BookingsLayoutClient>
			<Suspense fallback={<BookingsLayoutFallback />}>
				<StudioRouteGuard params={params} routePath="/bookings">
					{() => children}
				</StudioRouteGuard>
			</Suspense>
		</BookingsLayoutClient>
	);
}
