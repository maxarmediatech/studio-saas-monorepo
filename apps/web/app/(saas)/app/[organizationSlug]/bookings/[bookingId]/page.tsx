import { getActiveOrganization } from "@saas/auth/lib/server";
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

	return (
		<BookingDetailPageClient
			organizationSlug={organizationSlug}
			bookingId={bookingId}
		/>
	);
}
