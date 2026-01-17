import { getActiveOrganization } from "@saas/auth/lib/server";
import { bookingsApi } from "@saas/studio/lib/api";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { BookingDetailPageClient } from "./BookingDetailPageClient";

type Props = {
	params: Promise<{ organizationSlug: string; bookingId: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Booking Details | ${organization?.name ?? "Studio"}`,
	};
}

export default async function BookingDetailPage({ params }: Props) {
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
