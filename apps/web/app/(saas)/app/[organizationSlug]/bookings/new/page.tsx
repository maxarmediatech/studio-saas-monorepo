import { redirect } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export default async function NewBookingPage({ params }: Props) {
	const { organizationSlug } = await params;
	redirect(`/app/${organizationSlug}/bookings/new/details`);
}
