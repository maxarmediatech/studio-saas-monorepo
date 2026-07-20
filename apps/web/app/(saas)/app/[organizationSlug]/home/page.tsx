import { getActiveOrganization, getSession } from "@saas/auth/lib/server";
import { HomeView } from "@saas/studio/components/home";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const activeOrganization = await getActiveOrganization(organizationSlug);

	return {
		title: `Home | ${activeOrganization?.name ?? "Studio"}`,
	};
}

export default async function HomePage({ params }: Props) {
	const { organizationSlug } = await params;

	// Parallel fetch to avoid waterfall
	const [session, activeOrganization] = await Promise.all([
		getSession(),
		getActiveOrganization(organizationSlug),
	]);

	if (!activeOrganization) {
		return notFound();
	}

	return (
		<HomeView
			organizationSlug={organizationSlug}
			timeZone={session?.user?.timezone ?? "UTC"}
			userName={session?.user?.name ?? ""}
		/>
	);
}
