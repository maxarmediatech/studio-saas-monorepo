import { buildStudioRoutePath } from "@saas/studio/lib/route-access";
import { requireStudioRouteAccess } from "@saas/studio/lib/server-access";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BookingsLayoutClient } from "./bookings-layout-client";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default async function BookingsLayout({ params, children }: Props) {
	const { organizationSlug } = await params;
	if (
		!(await requireStudioRouteAccess(
			organizationSlug,
			buildStudioRoutePath(organizationSlug, "/bookings"),
		))
	) {
		notFound();
	}

	return (
		<BookingsLayoutClient organizationSlug={organizationSlug}>
			{children}
		</BookingsLayoutClient>
	);
}
