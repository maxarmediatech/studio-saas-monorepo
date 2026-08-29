import { PageContent } from "@saas/studio";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";
import { BookingsLayoutClient } from "./bookings-layout-client";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function BookingsLayout({ params, children }: Props) {
	return (
		<Suspense fallback={<PageContent title="Bookings" />}>
			<StudioRouteGuard params={params} routePath="/bookings">
				{(organizationSlug) => (
					<BookingsLayoutClient organizationSlug={organizationSlug}>
						{children}
					</BookingsLayoutClient>
				)}
			</StudioRouteGuard>
		</Suspense>
	);
}
