import { getActiveOrganization } from "@saas/auth/lib/server";
import { DashboardView } from "@saas/studio/components/dashboard";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const activeOrganization = await getActiveOrganization(organizationSlug);

	return {
		title: `Dashboard | ${activeOrganization?.name ?? "Studio"}`,
	};
}

export default async function DashboardPage({ params }: Props) {
	const { organizationSlug } = await params;
	const activeOrganization = await getActiveOrganization(organizationSlug);

	if (!activeOrganization) {
		return notFound();
	}

	return <DashboardView organizationSlug={organizationSlug} />;
}
