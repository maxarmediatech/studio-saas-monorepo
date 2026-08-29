"use client";

import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { BookingsTableSkeleton, PageContent } from "@saas/studio";
import { StudioListRouteFallback } from "@saas/studio/components/StudioListRouteFallback";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BookingDetailPageSkeleton } from "./[bookingId]/components/BookingDetailPageSkeleton";

type Props = {
	children: ReactNode;
};

function useBookingsRoute() {
	const { organizationSlug } = useParams<{ organizationSlug: string }>();
	const pathname = usePathname();
	const baseRoute = `/app/${organizationSlug}/bookings`;
	const isNewBookingForm = pathname.startsWith(`${baseRoute}/new`);
	const isDetailPage =
		pathname !== baseRoute &&
		!isNewBookingForm &&
		pathname.startsWith(`${baseRoute}/`);

	return { baseRoute, isDetailPage, isNewBookingForm };
}

export function BookingsLayoutClient({ children }: Props) {
	const { baseRoute, isDetailPage, isNewBookingForm } = useBookingsRoute();

	if (isNewBookingForm || isDetailPage) {
		return <>{children}</>;
	}

	return (
		<PageContent
			title="Bookings"
			controls={
				<Button asChild size="sm" className="hidden md:inline-flex">
					<Link href={`${baseRoute}/new/details`}>
						<PlusIcon className="mr-2 h-4 w-4" />
						New Booking
					</Link>
				</Button>
			}
		>
			{children}
		</PageContent>
	);
}

export function BookingsLayoutFallback() {
	const { isDetailPage, isNewBookingForm } = useBookingsRoute();

	if (isDetailPage) {
		return <BookingDetailPageSkeleton />;
	}

	if (isNewBookingForm) {
		return (
			<PageContent title="New Booking">
				<div
					className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]"
					aria-hidden="true"
				>
					<Skeleton className="h-80 w-full" />
					<div className="space-y-4">
						<Skeleton className="h-8 w-48" />
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-28 w-full" />
					</div>
				</div>
			</PageContent>
		);
	}

	return (
		<StudioListRouteFallback label="bookings">
			<BookingsTableSkeleton />
		</StudioListRouteFallback>
	);
}
