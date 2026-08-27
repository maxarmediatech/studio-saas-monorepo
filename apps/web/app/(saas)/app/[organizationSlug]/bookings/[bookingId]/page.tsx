import { getActiveOrganization } from "@saas/auth/lib/server";
import { bookingsApi } from "@saas/studio/lib/api";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookingDetailPageClient } from "./BookingDetailPageClient";
import { BookingDetailPageSkeleton } from "./components/BookingDetailPageSkeleton";

type Props = {
	params: Promise<{ organizationSlug: string; bookingId: string }>;
};

export const metadata = {
	title: "Booking Details | Studio",
};

export default function BookingDetailPage({ params }: Props) {
	return (
		<Suspense fallback={<BookingDetailPageSkeleton />}>
			<BookingDetailContent params={params} />
		</Suspense>
	);
}

async function BookingDetailContent({ params }: Props) {
	const { organizationSlug, bookingId } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	// Prefetch booking data on the server
	const queryClient = getServerQueryClient();
	await queryClient.prefetchQuery(bookingsApi.getOptions(bookingId));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<BookingDetailPageClient
				organizationSlug={organizationSlug}
				bookingId={bookingId}
			/>
		</HydrationBoundary>
	);
}
